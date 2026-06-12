import { listInventoryExpiryNotificationCandidatesFromDb, markInventoryExpiryTaskNotifiedInDb, syncInventoryExpiryTasksInDb, type InventoryExpiryNotificationCandidate } from '@/lib/inventory-expiry-tasks-repository';
import {
  createInventoryNotificationLogInDb,
  createInventoryNotificationLogTaskLinksInDb
} from '@/lib/inventory-notification-logs-repository';
import { createInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { sendInventoryTelegramMessage } from '@/lib/inventory-telegram-api';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { type InventoryUserRole } from '@/lib/inventory-user-roles';
import { listInventoryUsersFromDb, type InventoryUserRecord } from '@/lib/inventory-users-repository';

function buildInventoryTasksUrl(baseUrl: string, token: string, notificationId?: number | null) {
  const url = new URL('/inventory/tasks', baseUrl);
  url.searchParams.set('token', token);
  if (notificationId && Number.isFinite(notificationId) && notificationId > 0) {
    url.searchParams.set('notificationId', String(notificationId));
  }
  return url.toString();
}

function rolePriority(role: InventoryUserRole) {
  return role === 'admin' || role === 'store_manager' || role === 'manager' ? 0 : 1;
}

function normalizeRecipients(users: InventoryUserRecord[]) {
  const seen = new Set<number>();
  return [...users]
    .filter((user) => user.isActive && Boolean(user.userChatId))
    .sort((a, b) => rolePriority(a.role) - rolePriority(b.role) || a.id - b.id)
    .filter((user) => {
      if (seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    });
}

function recipientsForTask(task: InventoryExpiryNotificationCandidate, users: InventoryUserRecord[]) {
  const managers = users.filter((user) => rolePriority(user.role) === 0);
  const responsibleUsers = users.filter((user) => user.id === task.responsibleUserId);

  if (task.taskAssignmentMode === 'shared') {
    return normalizeRecipients(users);
  }

  if (task.taskAssignmentMode === 'hybrid') {
    return normalizeRecipients([...users.filter((user) => rolePriority(user.role) === 1), ...managers]);
  }

  return normalizeRecipients([...responsibleUsers, ...managers]);
}

type RecipientDigest = {
  recipient: InventoryUserRecord;
  tasksById: Map<number, InventoryExpiryNotificationCandidate>;
};

export type InventoryNotificationDebugItem = {
  userId: number | null;
  name: string;
  role: string;
  chatId: string;
  taskIds: number[];
  stores: string[];
  active: number;
  critical: number;
  high: number;
  overdue: number;
  repeat: number;
  skipped: boolean;
  reason: string;
  sentCount: number;
  ok?: boolean;
  error?: string;
};

export type InventoryNotificationsRunResult = {
  candidates: number;
  batchesProcessed: number;
  notificationsSent: number;
  debug: InventoryNotificationDebugItem[];
};

function buildDigestText(tasks: InventoryExpiryNotificationCandidate[]) {
  const active = tasks.length;
  const critical = tasks.filter((task) => task.riskLevel === 'critical').length;
  const high = tasks.filter((task) => task.riskLevel === 'high').length;
  const overdue = tasks.filter((task) => task.daysLeftSnapshot < 0).length;
  const repeat = tasks.filter((task) => task.reminderKind === 'repeat').length;
  const stores = Array.from(new Set(tasks.map((task) => task.storeLabel).filter(Boolean)));
  const topProducts = tasks
    .slice()
    .sort((a, b) => a.daysLeftSnapshot - b.daysLeftSnapshot || a.id - b.id)
    .slice(0, 5);

  const lines = [
    'У вас є задачі по інвентарю.',
    stores.length > 0 ? `Магазин${stores.length > 1 ? 'и' : ''}: ${stores.join('; ')}` : '',
    `Активні: ${active}`,
    `Критичні: ${critical}`,
    `Високий ризик: ${high}`,
    `Прострочені: ${overdue}`,
    repeat > 0 ? `Повторні нагадування: ${repeat}` : '',
    '',
    'Найближчі до перевірки позиції:',
    ...topProducts.map((task) => {
      const daysLabel =
        task.daysLeftSnapshot < 0
          ? `протерміновано на ${Math.abs(task.daysLeftSnapshot)} дн.`
          : `залишилось ${task.daysLeftSnapshot} дн.`;
      return `• ${task.productName} — партія #${task.batchId}, ${daysLabel}`;
    }),
    '',
    'Відкрийте Web App, щоб переглянути список задач і виконати перевірку.'
  ];

  return {
    text: lines.filter(Boolean).join('\n'),
    active,
    critical,
    high,
    overdue,
    repeat,
    stores
  };
}

export async function runInventoryExpiryNotifications(): Promise<InventoryNotificationsRunResult> {
  const settings = await getInventoryTelegramSettingsFromDb();
  if (!settings.enabled || !settings.botToken || !settings.publicBaseUrl || !settings.webhookSecret) {
    throw new Error('Telegram inventory integration is not fully configured.');
  }

  await syncInventoryExpiryTasksInDb();
  const candidates: InventoryExpiryNotificationCandidate[] = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const page = await listInventoryExpiryNotificationCandidatesFromDb(pageSize, offset);
    if (page.length === 0) break;

    candidates.push(...page);
    offset += page.length;

    if (page.length < pageSize) break;
  }

  let notificationsSent = 0;
  const notifiedTaskIds = new Set<number>();
  const debug: InventoryNotificationDebugItem[] = [];
  const recipientDigests = new Map<number, RecipientDigest>();
  const storeUsersCache = new Map<number, InventoryUserRecord[]>();

  for (const task of candidates) {
    let storeUsers = storeUsersCache.get(task.storeId);
    if (!storeUsers) {
      storeUsers = await listInventoryUsersFromDb({ storeId: task.storeId, limit: 300 });
      storeUsersCache.set(task.storeId, storeUsers);
    }

    const recipients = recipientsForTask(task, storeUsers);

    if (recipients.length === 0) {
      debug.push({
        userId: null,
        name: '',
        role: '',
        chatId: '',
        taskIds: [task.id],
        stores: [task.storeLabel].filter(Boolean),
        active: 1,
        critical: task.riskLevel === 'critical' ? 1 : 0,
        high: task.riskLevel === 'high' ? 1 : 0,
        overdue: task.daysLeftSnapshot < 0 ? 1 : 0,
        repeat: task.reminderKind === 'repeat' ? 1 : 0,
        skipped: true,
        reason: 'Для цього магазину немає активних користувачів з user_chat_id для отримання сповіщення.',
        sentCount: 0
      });
      continue;
    }

    for (const recipient of recipients) {
      const existing = recipientDigests.get(recipient.id);
      if (existing) {
        existing.tasksById.set(task.id, task);
        continue;
      }

      recipientDigests.set(recipient.id, {
        recipient,
        tasksById: new Map([[task.id, task]])
      });
    }
  }

  for (const digest of recipientDigests.values()) {
    const tasks = Array.from(digest.tasksById.values()).sort(
      (a, b) => a.daysLeftSnapshot - b.daysLeftSnapshot || a.id - b.id
    );
    const { text, active, critical, high, overdue, repeat, stores } = buildDigestText(tasks);
    const recipientName = `${digest.recipient.surname} ${digest.recipient.name}`.trim();
    const token = createInventoryRegistrationToken(
      {
        chatId: digest.recipient.userChatId,
        firstName: digest.recipient.name,
        lastName: digest.recipient.surname,
        username: ''
      },
      settings.webhookSecret,
      1000 * 60 * 60 * 24 * 7
    );
    try {
      const notificationId = await createInventoryNotificationLogInDb({
        taskId: null,
        batchId: null,
        productId: null,
        storeId: digest.recipient.storeId ? Number(digest.recipient.storeId) : tasks[0]?.storeId ?? null,
        userId: digest.recipient.id,
        notificationType: repeat > 0 ? 'inventory_tasks_digest_repeat' : 'inventory_tasks_digest',
        messageText: text
      });
      await createInventoryNotificationLogTaskLinksInDb({
        notificationLogId: notificationId,
        taskIds: tasks.map((task) => task.id)
      });
      const tasksUrl = buildInventoryTasksUrl(settings.publicBaseUrl, token, notificationId);
      await sendInventoryTelegramMessage({
        botToken: settings.botToken,
        chatId: digest.recipient.userChatId,
        text,
        buttonText: 'Відкрити задачі',
        buttonUrl: tasksUrl
      });

      for (const task of tasks) {
        notifiedTaskIds.add(task.id);
      }

      notificationsSent += 1;
      debug.push({
        userId: digest.recipient.id,
        name: recipientName,
        role: digest.recipient.role,
        chatId: digest.recipient.userChatId,
        taskIds: tasks.map((task) => task.id),
        stores,
        active,
        critical,
        high,
        overdue,
        repeat,
        skipped: false,
        reason: 'Зведене повідомлення успішно надіслано.',
        sentCount: 1,
        ok: true
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Telegram send error';

      const failedNotificationId = await createInventoryNotificationLogInDb({
        taskId: null,
        batchId: null,
        productId: null,
        storeId: digest.recipient.storeId ? Number(digest.recipient.storeId) : tasks[0]?.storeId ?? null,
        userId: digest.recipient.id,
        notificationType: repeat > 0 ? 'inventory_tasks_digest_repeat_failed' : 'inventory_tasks_digest_failed',
        messageText: `${text}\n\nSEND_ERROR: ${errorMessage}\nCHAT_ID: ${digest.recipient.userChatId}`
      });
      await createInventoryNotificationLogTaskLinksInDb({
        notificationLogId: failedNotificationId,
        taskIds: tasks.map((task) => task.id)
      });

      debug.push({
        userId: digest.recipient.id,
        name: recipientName,
        role: digest.recipient.role,
        chatId: digest.recipient.userChatId,
        taskIds: tasks.map((task) => task.id),
        stores,
        active,
        critical,
        high,
        overdue,
        repeat,
        skipped: true,
        reason: 'Не вдалося надіслати зведене повідомлення. Помилку записано в notification_logs.',
        sentCount: 0,
        ok: false,
        error: errorMessage
      });
    }
  }

  for (const taskId of notifiedTaskIds) {
    await markInventoryExpiryTaskNotifiedInDb(taskId);
  }

  return {
    candidates: candidates.length,
    batchesProcessed: notifiedTaskIds.size,
    notificationsSent,
    debug
  };
}
