import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

type InventoryDbExecutor = Pool | PoolConnection;

type InventoryManualProductCreationRow = RowDataPacket & {
  id: number;
  created_at: Date | string;
  comment: string | null;
  product_id: number | null;
  product_name: string | null;
  article: string | null;
  barcode: string | null;
  user_id: number | null;
  user_name: string | null;
  user_surname: string | null;
  store_id: number | null;
  store_code: string | null;
  city: string | null;
  address_line: string | null;
  approval_status: string | null;
  created_source: string | null;
  approval_requested_at: Date | string | null;
  approved_at: Date | string | null;
  approved_by_user_id: number | null;
  approval_note: string | null;
};

export type InventoryManualProductCreationRecord = {
  id: number;
  createdAt: string;
  comment: string;
  productId: number | null;
  productName: string;
  article: string;
  barcode: string;
  userId: number | null;
  userName: string;
  userSurname: string;
  storeId: number | null;
  storeLabel: string;
  approvalStatus: string;
  createdSource: string;
  approvalRequestedAt: string;
  approvedAt: string;
  approvedByUserId: number | null;
  approvalNote: string;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function mapManualProductCreationRow(row: InventoryManualProductCreationRow): InventoryManualProductCreationRecord {
  return {
    id: row.id,
    createdAt: toIso(row.created_at),
    comment: row.comment ?? '',
    productId: row.product_id,
    productName: row.product_name ?? '',
    article: row.article ?? '',
    barcode: row.barcode ?? '',
    userId: row.user_id,
    userName: row.user_name ?? '',
    userSurname: row.user_surname ?? '',
    storeId: row.store_id,
    storeLabel: [row.store_code, row.city, row.address_line].filter(Boolean).join(' | '),
    approvalStatus: String(row.approval_status ?? 'approved').trim() || 'approved',
    createdSource: String(row.created_source ?? 'admin').trim() || 'admin',
    approvalRequestedAt: toIso(row.approval_requested_at),
    approvedAt: toIso(row.approved_at),
    approvedByUserId: row.approved_by_user_id ?? null,
    approvalNote: row.approval_note ?? ''
  };
}

export async function createInventoryActivityLogInDb(
  input: {
    userId?: number | null;
    batchId?: number | null;
    productId?: number | null;
    storeId?: number | null;
    actionType: string;
    comment?: string | null;
    oldQuantity?: number | null;
    newQuantity?: number | null;
    oldExpiryDate?: string | null;
    newExpiryDate?: string | null;
  },
  executor?: InventoryDbExecutor
) {
  const db = executor ?? getDbPool();

  await db.query(
    `
      INSERT INTO activity_logs (
        user_id,
        batch_id,
        product_id,
        store_id,
        action_type,
        comment,
        old_quantity,
        new_quantity,
        old_expiry_date,
        new_expiry_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.userId ?? null,
      input.batchId ?? null,
      input.productId ?? null,
      input.storeId ?? null,
      input.actionType,
      input.comment ?? null,
      input.oldQuantity ?? null,
      input.newQuantity ?? null,
      input.oldExpiryDate ?? null,
      input.newExpiryDate ?? null
    ]
  );
}

export async function listInventoryManualProductCreationsFromDb(limit = 100): Promise<InventoryManualProductCreationRecord[]> {
  const db = getDbPool();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const [rows] = await db.query<InventoryManualProductCreationRow[]>(
    `
      SELECT
        al.id,
        al.created_at,
        al.comment,
        al.product_id,
        p.product_name,
        p.article,
        (
          SELECT pb.barcode
          FROM product_barcodes pb
          WHERE pb.product_id = p.id
          ORDER BY pb.id ASC
          LIMIT 1
        ) AS barcode,
        p.approval_status,
        p.created_source,
        p.approval_requested_at,
        p.approved_at,
        p.approved_by_user_id,
        p.approval_note,
        al.user_id,
        u.name AS user_name,
        u.surname AS user_surname,
        al.store_id,
        s.store_code,
        s.city,
        s.address_line
      FROM activity_logs al
      LEFT JOIN products p ON p.id = al.product_id
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN stores s ON s.id = al.store_id
      WHERE al.action_type = 'product_created_from_telegram_intake'
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [safeLimit]
  );

  return rows.map(mapManualProductCreationRow);
}
