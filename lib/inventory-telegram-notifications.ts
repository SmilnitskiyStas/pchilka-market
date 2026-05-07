import { syncInventoryExpiryTasksInDb, listInventoryExpiryNotificationCandidatesFromDb, markInventoryExpiryTaskNotifiedInDb } from '@/lib/inventory-expiry-tasks-repository';
import { createInventoryNotificationLogInDb } from '@/lib/inventory-notification-logs-repository';
import { createInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { sendInventoryTelegramMessage } from '@/lib/inventory-telegram-bot';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { type InventoryUserRole } from '@/lib/inventory-user-roles';
import { listInventoryUsersFromDb, type InventoryUserRecord } from '@/lib/inventory-users-repository';

function buildInventoryBatchCheckUrl(baseUrl: string, token: string, batchId: string) {
  const url = new URL('/inventory/batch-check', baseUrl);
  url.searchParams.set('token', token);
  url.searchParams.set('batchId', batchId);
  return url.toString();
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
  taskId: number;
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

  await syncInventoryExpiryTasksInDb();
  const candidates = await listInventoryExpiryNotificationCandidatesFromDb(200);
  let batchesProcessed = 0;
  let notificationsSent = 0;
  const debug: InventoryNotificationDebugItem[] = [];

  for (const task of candidates) {
    const storeUsers = await listInventoryUsersFromDb({ storeId: task.storeId, limit: 300 });
    const recipients =
      task.reminderKind === 'repeat'
        ? repeatReminderRecipients(storeUsers, task.responsibleUserId)
        : uniqueRecipients(storeUsers, task.responsibleUserId);
    const recipientDebug: InventoryNotificationRecipientDebug[] = recipients.map((recipient) => ({
      userId: recipient.id,
      name: `${recipient.surname} ${recipient.name}`.trim(),
      role: recipient.role,
      chatId: recipient.userChatId
    }));

    if (recipients.length === 0) {
      debug.push({
        taskId: task.id,
        batchId: String(task.batchId),
        productName: task.productName,
        storeLabel: task.storeLabel,
        expiryDate: task.dueDate,
        reminderKind: task.reminderKind,
        daysLeft: task.daysLeftSnapshot,
        responsibleUserName: task.responsibleUserName,
        recipients: recipientDebug,
        skipped: true,
        reason: 'У магазині немає активних користувачів з user_chat_id для отримання повідомлення.',
        sentCount: 0
      });
      continue;
    }

    const urgencyText = buildUrgencyText(task.daysLeftSnapshot);
    let sentForTask = 0;
    let failedForTask = 0;

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
      const batchUrl = buildInventoryBatchCheckUrl(settings.publicBaseUrl, token, String(task.batchId));
      const reminderPrefix = task.reminderKind === 'repeat' ? 'Повторне нагадування.\n' : '';
      const text = reminderPrefix +
        `Потрібно перевірити товар у магазині ${task.storeLabel}.\n` +
        `Товар: ${task.productName}\n` +
        `Артикул: ${task.article || '—'}\n` +
        `Штрихкод: ${task.barcode || '—'}\n` +
        `Код партії: ${task.batchCode || '—'}\n` +
        `Партія: #${task.batchId}\n` +
        `Термін придатності: ${task.dueDate}\n` +
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
          taskId: task.id,
          batchId: task.batchId,
          productId: task.productId,
          storeId: task.storeId,
          userId: recipient.id,
          notificationType: task.reminderKind === 'repeat' ? 'expiry_task_due_repeat' : 'expiry_task_due',
          messageText: text
        });

        recipientDebug[index] = { ...recipientDebug[index], ok: true };
        notificationsSent += 1;
        sentForTask += 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown Telegram send error';

        await createInventoryNotificationLogInDb({
          taskId: task.id,
          batchId: task.batchId,
          productId: task.productId,
          storeId: task.storeId,
          userId: recipient.id,
          notificationType: task.reminderKind === 'repeat' ? 'expiry_task_due_repeat_failed' : 'expiry_task_due_failed',
          messageText: `${text}\n\nSEND_ERROR: ${errorMessage}\nCHAT_ID: ${recipient.userChatId}`
        });

        recipientDebug[index] = {
          ...recipientDebug[index],
          ok: false,
          error: errorMessage
        };
        failedForTask += 1;
      }
    }

    if (sentForTask > 0) {
      await markInventoryExpiryTaskNotifiedInDb(task.id);
      batchesProcessed += 1;
    }

    debug.push({
      taskId: task.id,
      batchId: String(task.batchId),
      productName: task.productName,
      storeLabel: task.storeLabel,
      expiryDate: task.dueDate,
      reminderKind: task.reminderKind,
      daysLeft: task.daysLeftSnapshot,
      responsibleUserName: task.responsibleUserName,
      recipients: recipientDebug,
      skipped: sentForTask === 0,
      reason:
        sentForTask === 0
          ? failedForTask > 0
            ? 'Не вдалося надіслати жодне повідомлення. Помилки записано в notification_logs.'
            : 'Повідомлення не надіслано.'
          : failedForTask > 0
            ? 'Повідомлення надіслано частково. Частину помилок записано в notification_logs.'
            : 'Повідомлення успішно надіслано.',
      sentCount: sentForTask
    });
  }

  return {
    candidates: candidates.length,
    batchesProcessed,
    notificationsSent,
    debug
  };
}
