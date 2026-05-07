import { createInventoryNotificationLogInDb } from '@/lib/inventory-notification-logs-repository';
import { type InventoryUserRole } from '@/lib/inventory-user-roles';
import {
  listInventoryNotificationCandidatesFromDb,
  markInventoryBatchNotifiedInDb
} from '@/lib/inventory-batches-repository';
import { createInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { sendInventoryTelegramMessage } from '@/lib/inventory-telegram-bot';
import { listInventoryUsersFromDb, type InventoryUserRecord } from '@/lib/inventory-users-repository';

function buildInventoryBatchCheckUrl(baseUrl: string, token: string, batchId: string) {
  const url = new URL('/inventory/batch-check', baseUrl);
  url.searchParams.set('token', token);
  url.searchParams.set('batchId', batchId);
  return url.toString();
}

function daysLeftUntil(value: string) {
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
}

function uniqueRecipients(users: InventoryUserRecord[], responsibleUserDbId: number | null) {
  const seen = new Set<number>();
  const prioritized = [...users].sort((a, b) => {
    const getPriority = (role: InventoryUserRole) =>
      role === 'admin' || role === 'store_manager' || role === 'manager' ? 1 : 2;
    const aPriority = a.id === responsibleUserDbId ? 0 : getPriority(a.role);
    const bPriority = b.id === responsibleUserDbId ? 0 : getPriority(b.role);
    return aPriority - bPriority || a.id - b.id;
  });

  return prioritized.filter((user) => {
    if (!user.isActive || !user.userChatId) return false;
    if (seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
}

function repeatReminderRecipients(users: InventoryUserRecord[], responsibleUserDbId: number | null) {
  const seen = new Set<number>();
  const prioritized = [...users]
    .filter((user) => user.id === responsibleUserDbId || user.role === 'store_manager')
    .sort((a, b) => {
      const aPriority = a.id === responsibleUserDbId ? 0 : 1;
      const bPriority = b.id === responsibleUserDbId ? 0 : 1;
      return aPriority - bPriority || a.id - b.id;
    });

  return prioritized.filter((user) => {
    if (!user.isActive || !user.userChatId) return false;
    if (seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
}

function buildUrgencyText(daysLeft: number) {
  if (daysLeft < 0) {
    return `Термін придатності вже сплив ${Math.abs(daysLeft)} дн. тому.`;
  }

  if (daysLeft === 0) {
    return 'Термін придатності спливає сьогодні.';
  }

  return `До завершення терміну придатності залишилось ${daysLeft} дн.`;
}

export type InventoryNotificationDebugItem = {
  batchId: string;
  productName: string;
  storeLabel: string;
  expiryDate: string;
  reminderKind: 'initial' | 'repeat';
  daysLeft: number;
  responsibleUserName: string;
  recipients: Array<{
    userId: number;
    name: string;
    role: string;
    chatId: string;
    ok?: boolean;
    error?: string;
  }>;
  skipped: boolean;
  reason: string;
  sentCount: number;
};

export type InventoryNotificationsRunResult = {
  candidates: number;
  batchesProcessed: number;
  notificationsSent: number;
  debug: InventoryNotificationDebugItem[];
};

type InventoryNotificationRecipientDebug = InventoryNotificationDebugItem['recipients'][number];

export async function runInventoryExpiryNotifications(): Promise<InventoryNotificationsRunResult> {
  const settings = await getInventoryTelegramSettingsFromDb();
  if (!settings.enabled || !settings.botToken || !settings.publicBaseUrl || !settings.webhookSecret) {
    throw new Error('Telegram inventory integration is not fully configured.');
  }

  const candidates = await listInventoryNotificationCandidatesFromDb(200);
  let batchesProcessed = 0;
  let notificationsSent = 0;
  const debug: InventoryNotificationDebugItem[] = [];

  for (const batch of candidates) {
    const storeUsers = await listInventoryUsersFromDb({ storeId: batch.storeId, limit: 300 });
    const recipients = batch.isRepeatReminder
      ? repeatReminderRecipients(storeUsers, batch.responsibleUserDbId)
      : uniqueRecipients(storeUsers, batch.responsibleUserDbId);
    const daysLeft = daysLeftUntil(batch.expiryDate);
    const recipientDebug: InventoryNotificationRecipientDebug[] = recipients.map((recipient) => ({
      userId: recipient.id,
      name: `${recipient.surname} ${recipient.name}`.trim(),
      role: recipient.role,
      chatId: recipient.userChatId
    }));

    if (recipients.length === 0) {
      debug.push({
        batchId: batch.id,
        productName: batch.productName,
        storeLabel: batch.storeLabel,
        expiryDate: batch.expiryDate,
        reminderKind: batch.isRepeatReminder ? 'repeat' : 'initial',
        daysLeft,
        responsibleUserName: batch.responsibleUserName,
        recipients: recipientDebug,
        skipped: true,
        reason: 'У магазині немає активних користувачів з user_chat_id для отримання повідомлення.',
        sentCount: 0
      });
      continue;
    }

    const urgencyText = buildUrgencyText(daysLeft);
    let sentForBatch = 0;
    let failedForBatch = 0;

    for (let index = 0; index < recipients.length; index += 1) {
      const recipient = recipients[index];
      const token = createInventoryRegistrationToken(
        {
          chatId: recipient.userChatId,
          firstName: recipient.name,
          lastName: recipient.surname,
          username: ''
        },
        settings.webhookSecret,
        1000 * 60 * 60 * 24 * 7
      );
      const batchUrl = buildInventoryBatchCheckUrl(settings.publicBaseUrl, token, batch.id);
      const reminderPrefix = batch.isRepeatReminder ? 'Повторне нагадування.\n' : '';
      const text = reminderPrefix +
        `Потрібно перевірити товар у магазині ${batch.storeLabel}.\n` +
        `Товар: ${batch.productName}\n` +
        `Артикул: ${batch.article || '—'}\n` +
        `Штрихкод: ${batch.barcode || '—'}\n` +
        `Код партії: ${batch.batchCode || '—'}\n` +
        `Партія: #${batch.id}\n` +
        `Термін придатності: ${batch.expiryDate}\n` +
        `${urgencyText}`;

      try {
        await sendInventoryTelegramMessage({
          botToken: settings.botToken,
          chatId: recipient.userChatId,
          text,
          buttonText: 'Перевірити товар',
          buttonUrl: batchUrl
        });

        await createInventoryNotificationLogInDb({
          batchId: Number(batch.id),
          productId: Number(batch.productId),
          storeId: Number(batch.storeId),
          userId: recipient.id,
          notificationType: batch.isRepeatReminder ? 'expiry_check_due_repeat' : 'expiry_check_due',
          messageText: text
        });

        recipientDebug[index] = {
          ...recipientDebug[index],
          ok: true
        };
        notificationsSent += 1;
        sentForBatch += 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown Telegram send error';

        await createInventoryNotificationLogInDb({
          batchId: Number(batch.id),
          productId: Number(batch.productId),
          storeId: Number(batch.storeId),
          userId: recipient.id,
          notificationType: batch.isRepeatReminder ? 'expiry_check_due_repeat_failed' : 'expiry_check_due_failed',
          messageText: `${text}\n\nSEND_ERROR: ${errorMessage}\nCHAT_ID: ${recipient.userChatId}`
        });

        recipientDebug[index] = {
          ...recipientDebug[index],
          ok: false,
          error: errorMessage
        };
        failedForBatch += 1;
      }
    }

    if (sentForBatch > 0) {
      await markInventoryBatchNotifiedInDb(batch.id);
      batchesProcessed += 1;
    }

    debug.push({
      batchId: batch.id,
      productName: batch.productName,
      storeLabel: batch.storeLabel,
      expiryDate: batch.expiryDate,
      reminderKind: batch.isRepeatReminder ? 'repeat' : 'initial',
      daysLeft,
      responsibleUserName: batch.responsibleUserName,
      recipients: recipientDebug,
      skipped: sentForBatch === 0,
      reason:
        sentForBatch === 0
          ? failedForBatch > 0
            ? 'Не вдалося надіслати жодне повідомлення. Помилки записано в notification_logs.'
            : 'Повідомлення не надіслано.'
          : failedForBatch > 0
            ? 'Повідомлення надіслано частково. Частину помилок записано в notification_logs.'
            : 'Повідомлення успішно надіслано.',
      sentCount: sentForBatch
    });
  }

  return {
    candidates: candidates.length,
    batchesProcessed,
    notificationsSent,
    debug
  };
}
