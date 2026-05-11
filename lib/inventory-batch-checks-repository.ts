import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

type InventoryDbExecutor = Pool | PoolConnection;

type BatchCheckRow = RowDataPacket & {
  id: number;
  batch_id: number;
  task_id: number | null;
  product_id: number;
  store_id: number;
  user_id: number;
  action: string;
  counted_quantity: number | null;
  item_condition: string | null;
  issue_reason: string | null;
  note: string | null;
  photo_url: string | null;
  created_at: Date | string;
  user_name: string | null;
  user_surname: string | null;
};

export type InventoryBatchCheckRecord = {
  id: number;
  batchId: number;
  taskId: number | null;
  productId: number;
  storeId: number;
  userId: number;
  userName: string;
  action: string;
  countedQuantity: number | null;
  itemCondition: string;
  issueReason: string;
  note: string;
  photoUrl: string;
  createdAt: string;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function mapRow(row: BatchCheckRow): InventoryBatchCheckRecord {
  return {
    id: row.id,
    batchId: row.batch_id,
    taskId: row.task_id ?? null,
    productId: row.product_id,
    storeId: row.store_id,
    userId: row.user_id,
    userName: [row.user_surname, row.user_name].filter(Boolean).join(' '),
    action: row.action,
    countedQuantity: row.counted_quantity == null ? null : Number(row.counted_quantity),
    itemCondition: row.item_condition ?? '',
    issueReason: row.issue_reason ?? '',
    note: row.note ?? '',
    photoUrl: row.photo_url ?? '',
    createdAt: toIso(row.created_at)
  };
}

export async function createInventoryBatchCheckInDb(
  input: {
    batchId: number;
    taskId?: number | null;
    productId: number;
    storeId: number;
    userId: number;
    action: 'checked' | 'writeoff' | 'discussion_required';
    countedQuantity?: number | null;
    itemCondition?: string | null;
    issueReason?: string | null;
    note?: string | null;
    photoUrl?: string | null;
  },
  executor?: InventoryDbExecutor
) {
  const db = executor ?? getDbPool();
  const countedQuantity =
    input.countedQuantity == null ? null : Math.max(Math.round(Number(input.countedQuantity)), 0);

  const [result] = await db.query<ResultSetHeader>(
    `
      INSERT INTO batch_checks (
        batch_id,
        task_id,
        product_id,
        store_id,
        user_id,
        action,
        counted_quantity,
        item_condition,
        issue_reason,
        note,
        photo_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.batchId,
      input.taskId ?? null,
      input.productId,
      input.storeId,
      input.userId,
      input.action,
      countedQuantity,
      input.itemCondition?.trim() || null,
      input.issueReason?.trim() || null,
      input.note?.trim() || null,
      input.photoUrl?.trim() || null
    ]
  );

  return result.insertId;
}

export async function listInventoryBatchChecksForBatchInDb(
  batchId: string | number,
  limit = 20
): Promise<InventoryBatchCheckRecord[]> {
  const db = getDbPool();
  const normalizedBatchId = Number(batchId);
  if (!Number.isFinite(normalizedBatchId) || normalizedBatchId <= 0) {
    return [];
  }

  const [rows] = await db.query<BatchCheckRow[]>(
    `
      SELECT
        bc.id,
        bc.batch_id,
        bc.task_id,
        bc.product_id,
        bc.store_id,
        bc.user_id,
        bc.action,
        bc.counted_quantity,
        bc.item_condition,
        bc.issue_reason,
        bc.note,
        bc.photo_url,
        bc.created_at,
        u.name AS user_name,
        u.surname AS user_surname
      FROM batch_checks bc
      LEFT JOIN users u ON u.id = bc.user_id
      WHERE bc.batch_id = ?
      ORDER BY bc.created_at DESC, bc.id DESC
      LIMIT ?
    `,
    [normalizedBatchId, Math.min(Math.max(limit, 1), 100)]
  );

  return rows.map(mapRow);
}
