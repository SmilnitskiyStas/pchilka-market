import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

type InventoryDbExecutor = Pool | PoolConnection;

type NotificationLogRow = RowDataPacket & {
  id: number;
  task_id: number | null;
  user_id: number | null;
  status: string;
  opened_at: Date | string | null;
};

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
  await db.query(
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
