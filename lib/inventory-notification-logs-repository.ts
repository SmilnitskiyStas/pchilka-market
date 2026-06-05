import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

type InventoryDbExecutor = Pool | PoolConnection;

type NotificationLogRow = RowDataPacket & {
  id: number;
  task_id: number | null;
  batch_id?: number | null;
  product_id?: number | null;
  store_id?: number | null;
  user_id: number | null;
  notification_type?: string;
  message_text?: string;
  status: string;
  opened_at: Date | string | null;
  opened_by_user_id?: number | null;
  sent_at?: Date | string;
  product_name?: string | null;
  article?: string | null;
  batch_code?: string | null;
  store_label?: string | null;
  recipient_name?: string | null;
  opened_by_name?: string | null;
};

type NotificationLogTaskLinkRow = RowDataPacket & {
  notification_log_id: number;
  task_id: number;
  batch_id: number | null;
  product_name?: string | null;
  batch_code?: string | null;
  task_status?: string | null;
  task_type?: string | null;
  assigned_user_id?: number | null;
  assigned_user_name?: string | null;
};

export type InventoryNotificationLogRecord = {
  id: number;
  taskId: number | null;
  batchId: number | null;
  productId: number | null;
  storeId: number | null;
  userId: number | null;
  notificationType: string;
  messageText: string;
  status: string;
  openedAt: string;
  openedByUserId: number | null;
  sentAt: string;
  productName: string;
  article: string;
  batchCode: string;
  storeLabel: string;
  recipientName: string;
  openedByName: string;
  linkedTasksCount: number;
  takenTasksCount: number;
  completedTasksCount: number;
  assignedUsersSummary: string;
  linkedTasks: Array<{
    taskId: number;
    batchId: number | null;
    productName: string;
    batchCode: string;
    taskStatus: string;
    taskType: string;
    assignedUserId: number | null;
    assignedUserName: string;
  }>;
};

export type InventoryNotificationLogsListResult = {
  logs: InventoryNotificationLogRecord[];
  totalCount: number;
  page: number;
  limit: number;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function mapNotificationLogRow(row: NotificationLogRow): InventoryNotificationLogRecord {
  return {
    id: row.id,
    taskId: row.task_id ?? null,
    batchId: row.batch_id ?? null,
    productId: row.product_id ?? null,
    storeId: row.store_id ?? null,
    userId: row.user_id ?? null,
    notificationType: String(row.notification_type ?? ''),
    messageText: String(row.message_text ?? ''),
    status: String(row.status ?? 'sent'),
    openedAt: toIso(row.opened_at),
    openedByUserId: row.opened_by_user_id ?? null,
    sentAt: toIso(row.sent_at),
    productName: String(row.product_name ?? ''),
    article: String(row.article ?? ''),
    batchCode: String(row.batch_code ?? ''),
    storeLabel: String(row.store_label ?? ''),
    recipientName: String(row.recipient_name ?? ''),
    openedByName: String(row.opened_by_name ?? ''),
    linkedTasksCount: 0,
    takenTasksCount: 0,
    completedTasksCount: 0,
    assignedUsersSummary: '',
    linkedTasks: []
  };
}

async function enrichNotificationLogsWithTaskLinks(db: InventoryDbExecutor, logs: InventoryNotificationLogRecord[]) {
  if (logs.length === 0) return logs;

  const logIds = logs.map((log) => log.id);
  const linkPlaceholders = logIds.map(() => '?').join(', ');
  const [linkRows] = await db.query<NotificationLogTaskLinkRow[]>(
    `
      SELECT
        nlt.notification_log_id,
        et.id AS task_id,
        et.batch_id,
        et.status AS task_status,
        et.task_type,
        et.assigned_user_id,
        CONCAT_WS(' ', au.surname, au.name) AS assigned_user_name,
        p.product_name,
        pb.batch_code
      FROM notification_log_tasks nlt
      INNER JOIN expiry_tasks et ON et.id = nlt.task_id
      LEFT JOIN product_batches pb ON pb.id = et.batch_id
      LEFT JOIN products p ON p.id = et.product_id
      LEFT JOIN users au ON au.id = et.assigned_user_id
      WHERE nlt.notification_log_id IN (${linkPlaceholders})
      ORDER BY et.updated_at DESC, et.id DESC
    `,
    logIds
  );

  const linksByLogId = new Map<number, NotificationLogTaskLinkRow[]>();
  for (const row of linkRows) {
    const items = linksByLogId.get(Number(row.notification_log_id)) ?? [];
    items.push(row);
    linksByLogId.set(Number(row.notification_log_id), items);
  }

  for (const log of logs) {
    const linkedRows = linksByLogId.get(log.id) ?? [];
    const assignedUsers = new Set<string>();

    log.linkedTasks = linkedRows.map((row) => {
      const assignedUserName = String(row.assigned_user_name ?? '').trim();
      if (assignedUserName) assignedUsers.add(assignedUserName);

      return {
        taskId: Number(row.task_id),
        batchId: row.batch_id == null ? null : Number(row.batch_id),
        productName: String(row.product_name ?? ''),
        batchCode: String(row.batch_code ?? ''),
        taskStatus: String(row.task_status ?? ''),
        taskType: String(row.task_type ?? ''),
        assignedUserId: row.assigned_user_id == null ? null : Number(row.assigned_user_id),
        assignedUserName
      };
    });

    log.linkedTasksCount = log.linkedTasks.length;
    log.takenTasksCount = log.linkedTasks.filter((task) => Boolean(task.assignedUserId)).length;
    log.completedTasksCount = log.linkedTasks.filter((task) => task.taskStatus === 'completed').length;
    log.assignedUsersSummary = Array.from(assignedUsers).join(', ');
  }

  return logs;
}

export async function createInventoryNotificationLogInDb(
  input: {
    taskId?: number | null;
    batchId?: number | null;
    productId?: number | null;
    storeId?: number | null;
    userId?: number | null;
    notificationType: string;
    messageText: string;
  },
  executor?: InventoryDbExecutor
) {
  const db = executor ?? getDbPool();
  const [result] = await db.query(
    `
      INSERT INTO notification_logs (
        task_id,
        batch_id,
        product_id,
        store_id,
        user_id,
        notification_type,
        message_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.taskId ?? null,
      input.batchId ?? null,
      input.productId ?? null,
      input.storeId ?? null,
      input.userId ?? null,
      input.notificationType,
      input.messageText
    ]
  );

  return Number((result as { insertId?: number }).insertId ?? 0);
}

export async function createInventoryNotificationLogTaskLinksInDb(input: {
  notificationLogId: string | number;
  taskIds: Array<string | number>;
}) {
  const db = getDbPool();
  const notificationLogId = Number(input.notificationLogId);
  const taskIds = Array.from(
    new Set(
      input.taskIds
        .map((taskId) => Number(taskId))
        .filter((taskId) => Number.isFinite(taskId) && taskId > 0)
    )
  );

  if (!Number.isFinite(notificationLogId) || notificationLogId <= 0 || taskIds.length === 0) {
    return;
  }

  const placeholders = taskIds.map(() => '(?, ?)').join(', ');
  const values = taskIds.flatMap((taskId) => [notificationLogId, taskId]);

  await db.query(
    `
      INSERT IGNORE INTO notification_log_tasks (
        notification_log_id,
        task_id
      ) VALUES ${placeholders}
    `,
    values
  );
}

export async function markInventoryNotificationOpenedInDb(input: {
  notificationId: string | number;
  userId: string | number;
}) {
  const db = getDbPool();
  const notificationId = Number(input.notificationId);
  const userId = Number(input.userId);
  if (!Number.isFinite(notificationId) || notificationId <= 0) return;
  if (!Number.isFinite(userId) || userId <= 0) return;

  await db.query(
    `
      UPDATE notification_logs
      SET
        status = 'opened',
        opened_at = COALESCE(opened_at, NOW()),
        opened_by_user_id = COALESCE(opened_by_user_id, ?)
      WHERE id = ? AND user_id = ?
    `,
    [userId, notificationId, userId]
  );
}

export async function findInventoryNotificationLogByIdInDb(notificationId: string | number) {
  const db = getDbPool();
  const normalizedNotificationId = Number(notificationId);
  if (!Number.isFinite(normalizedNotificationId) || normalizedNotificationId <= 0) return null;

  const [rows] = await db.query<NotificationLogRow[]>(
    `
      SELECT id, task_id, user_id, status, opened_at
      FROM notification_logs
      WHERE id = ?
      LIMIT 1
    `,
    [normalizedNotificationId]
  );

  return rows[0] ?? null;
}

export async function findInventoryNotificationLogDetailsByIdInDb(notificationId: string | number) {
  const db = getDbPool();
  const normalizedNotificationId = Number(notificationId);
  if (!Number.isFinite(normalizedNotificationId) || normalizedNotificationId <= 0) return null;

  const [rows] = await db.query<NotificationLogRow[]>(
    `
      SELECT
        nl.id,
        nl.task_id,
        nl.batch_id,
        nl.product_id,
        nl.store_id,
        nl.user_id,
        nl.notification_type,
        nl.message_text,
        nl.status,
        nl.opened_at,
        nl.opened_by_user_id,
        nl.sent_at,
        p.product_name,
        p.article,
        pb.batch_code,
        CONCAT_WS(' | ', s.store_code, s.city, s.address_line) AS store_label,
        CONCAT_WS(' ', ru.surname, ru.name) AS recipient_name,
        CONCAT_WS(' ', ou.surname, ou.name) AS opened_by_name
      FROM notification_logs nl
      LEFT JOIN products p ON p.id = nl.product_id
      LEFT JOIN product_batches pb ON pb.id = nl.batch_id
      LEFT JOIN stores s ON s.id = nl.store_id
      LEFT JOIN users ru ON ru.id = nl.user_id
      LEFT JOIN users ou ON ou.id = nl.opened_by_user_id
      WHERE nl.id = ?
      LIMIT 1
    `,
    [normalizedNotificationId]
  );

  const log = rows[0] ? mapNotificationLogRow(rows[0]) : null;
  if (!log) return null;

  const [enriched] = await Promise.all([enrichNotificationLogsWithTaskLinks(db, [log])]);
  return enriched[0] ?? null;
}

export async function listInventoryNotificationLogsFromDb(options?: {
  storeId?: string | number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  notificationType?: string | null;
  limit?: number;
  page?: number;
}) {
  const db = getDbPool();
  const storeId = Number(options?.storeId ?? 0);
  const dateFrom = String(options?.dateFrom ?? '').trim();
  const dateTo = String(options?.dateTo ?? '').trim();
  const notificationType = String(options?.notificationType ?? '').trim();
  const limit = Math.min(Math.max(Number(options?.limit ?? 50), 1), 200);
  const page = Math.max(Number(options?.page ?? 1) || 1, 1);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (Number.isFinite(storeId) && storeId > 0) {
    whereClauses.push('nl.store_id = ?');
    params.push(storeId);
  }
  if (dateFrom) {
    whereClauses.push('DATE(nl.sent_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClauses.push('DATE(nl.sent_at) <= ?');
    params.push(dateTo);
  }
  if (notificationType) {
    whereClauses.push('nl.notification_type = ?');
    params.push(notificationType);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await db.query<Array<RowDataPacket & { total_count: number }>>(
    `
      SELECT COUNT(*) AS total_count
      FROM notification_logs nl
      ${whereSql}
    `,
    params
  );

  const totalCount = Number(countRows[0]?.total_count ?? 0);

  const [rows] = await db.query<NotificationLogRow[]>(
    `
      SELECT
        nl.id,
        nl.task_id,
        nl.batch_id,
        nl.product_id,
        nl.store_id,
        nl.user_id,
        nl.notification_type,
        nl.message_text,
        nl.status,
        nl.opened_at,
        nl.opened_by_user_id,
        nl.sent_at,
        p.product_name,
        p.article,
        pb.batch_code,
        CONCAT_WS(' | ', s.store_code, s.city, s.address_line) AS store_label,
        CONCAT_WS(' ', ru.surname, ru.name) AS recipient_name,
        CONCAT_WS(' ', ou.surname, ou.name) AS opened_by_name
      FROM notification_logs nl
      LEFT JOIN products p ON p.id = nl.product_id
      LEFT JOIN product_batches pb ON pb.id = nl.batch_id
      LEFT JOIN stores s ON s.id = nl.store_id
      LEFT JOIN users ru ON ru.id = nl.user_id
      LEFT JOIN users ou ON ou.id = nl.opened_by_user_id
      ${whereSql}
      ORDER BY nl.sent_at DESC, nl.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const logs = rows.map(mapNotificationLogRow);
  if (logs.length === 0) {
    return {
      logs,
      totalCount,
      page,
      limit
    } satisfies InventoryNotificationLogsListResult;
  }
  await enrichNotificationLogsWithTaskLinks(db, logs);

  return {
    logs,
    totalCount,
    page,
    limit
  } satisfies InventoryNotificationLogsListResult;
}
