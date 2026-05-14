import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

type InventoryDbExecutor = Pool | PoolConnection;

type BatchExpiryCorrectionRow = RowDataPacket & {
  id: number;
  batch_id: number;
  product_id: number;
  store_id: number;
  old_expiry_date: string;
  new_expiry_date: string;
  reason: string;
  comment: string | null;
  photo_url: string | null;
  changed_by_user_id: number | null;
  changed_by_name: string | null;
  changed_by_surname: string | null;
  created_at: Date | string;
};

export type InventoryBatchExpiryCorrectionRecord = {
  id: number;
  batchId: number;
  productId: number;
  storeId: number;
  oldExpiryDate: string;
  newExpiryDate: string;
  reason: string;
  comment: string;
  photoUrl: string;
  changedByUserId: number | null;
  changedByUserName: string;
  createdAt: string;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function mapRow(row: BatchExpiryCorrectionRow): InventoryBatchExpiryCorrectionRecord {
  return {
    id: row.id,
    batchId: row.batch_id,
    productId: row.product_id,
    storeId: row.store_id,
    oldExpiryDate: String(row.old_expiry_date ?? ''),
    newExpiryDate: String(row.new_expiry_date ?? ''),
    reason: String(row.reason ?? ''),
    comment: String(row.comment ?? ''),
    photoUrl: String(row.photo_url ?? ''),
    changedByUserId: row.changed_by_user_id ?? null,
    changedByUserName: [row.changed_by_surname, row.changed_by_name].filter(Boolean).join(' '),
    createdAt: toIso(row.created_at)
  };
}

export async function createInventoryBatchExpiryCorrectionInDb(
  input: {
    batchId: number;
    productId: number;
    storeId: number;
    oldExpiryDate: string;
    newExpiryDate: string;
    reason: string;
    comment?: string | null;
    photoUrl?: string | null;
    changedByUserId?: number | null;
  },
  executor?: InventoryDbExecutor
): Promise<InventoryBatchExpiryCorrectionRecord> {
  const db = executor ?? getDbPool();

  const [result] = await db.query(
    `
      INSERT INTO batch_expiry_corrections (
        batch_id,
        product_id,
        store_id,
        old_expiry_date,
        new_expiry_date,
        reason,
        comment,
        photo_url,
        changed_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.batchId,
      input.productId,
      input.storeId,
      input.oldExpiryDate,
      input.newExpiryDate,
      input.reason.trim(),
      input.comment?.trim() || null,
      input.photoUrl?.trim() || null,
      input.changedByUserId ?? null
    ]
  );

  const insertId = Number((result as { insertId?: number }).insertId ?? 0);
  const [rows] = await db.query<BatchExpiryCorrectionRow[]>(
    `
      SELECT
        bec.id,
        bec.batch_id,
        bec.product_id,
        bec.store_id,
        DATE_FORMAT(bec.old_expiry_date, '%Y-%m-%d') AS old_expiry_date,
        DATE_FORMAT(bec.new_expiry_date, '%Y-%m-%d') AS new_expiry_date,
        bec.reason,
        bec.comment,
        bec.photo_url,
        bec.changed_by_user_id,
        u.name AS changed_by_name,
        u.surname AS changed_by_surname,
        bec.created_at
      FROM batch_expiry_corrections bec
      LEFT JOIN users u ON u.id = bec.changed_by_user_id
      WHERE bec.id = ?
      LIMIT 1
    `,
    [insertId]
  );

  if (!rows[0]) {
    throw new Error('Не вдалося прочитати збережене виправлення терміну придатності.');
  }

  return mapRow(rows[0]);
}

export async function listInventoryBatchExpiryCorrectionsByStoreInDb(
  storeId: string | number,
  limit = 100
): Promise<InventoryBatchExpiryCorrectionRecord[]> {
  const pool = getDbPool();
  const normalizedStoreId = Number(storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
    return [];
  }

  const [rows] = await pool.query<BatchExpiryCorrectionRow[]>(
    `
      SELECT
        bec.id,
        bec.batch_id,
        bec.product_id,
        bec.store_id,
        DATE_FORMAT(bec.old_expiry_date, '%Y-%m-%d') AS old_expiry_date,
        DATE_FORMAT(bec.new_expiry_date, '%Y-%m-%d') AS new_expiry_date,
        bec.reason,
        bec.comment,
        bec.photo_url,
        bec.changed_by_user_id,
        u.name AS changed_by_name,
        u.surname AS changed_by_surname,
        bec.created_at
      FROM batch_expiry_corrections bec
      LEFT JOIN users u ON u.id = bec.changed_by_user_id
      WHERE bec.store_id = ?
      ORDER BY bec.created_at DESC, bec.id DESC
      LIMIT ?
    `,
    [normalizedStoreId, Math.min(Math.max(Number(limit) || 100, 1), 300)]
  );

  return rows.map(mapRow);
}
