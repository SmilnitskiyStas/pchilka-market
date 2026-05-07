import type { Pool, PoolConnection } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

type InventoryDbExecutor = Pool | PoolConnection;

export async function createInventoryNotificationLogInDb(
  input: {
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
        batch_id,
        product_id,
        store_id,
        user_id,
        notification_type,
        message_text
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      input.batchId ?? null,
      input.productId ?? null,
      input.storeId ?? null,
      input.userId ?? null,
      input.notificationType,
      input.messageText
    ]
  );
}
