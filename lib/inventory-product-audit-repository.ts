import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import type { InventoryProductRecord } from '@/lib/inventory-product-types';

type InventoryDbExecutor = Pool | PoolConnection;

type ProductChangeLogRow = RowDataPacket & {
  id: number;
  product_id: number;
  product_name: string | null;
  article: string | null;
  barcode: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_source: string;
  changed_by: string | null;
  change_note: string | null;
  created_at: Date | string;
};

type ProductImportReviewRow = RowDataPacket & {
  id: number;
  product_id: number | null;
  article: string | null;
  product_name: string | null;
  existing_barcode: string | null;
  incoming_barcode: string | null;
  issue_type: string;
  status: string;
  note: string | null;
  resolved_note: string | null;
  resolved_by: string | null;
  resolved_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InventoryProductChangeLogRecord = {
  id: number;
  productId: number;
  productName: string;
  article: string;
  barcode: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changeSource: string;
  changedBy: string;
  changeNote: string;
  createdAt: string;
};

export type InventoryProductImportReviewRecord = {
  id: number;
  productId: number | null;
  article: string;
  productName: string;
  existingBarcode: string;
  incomingBarcode: string;
  issueType: string;
  status: string;
  note: string;
  resolvedNote: string;
  resolvedBy: string;
  resolvedAt: string;
  createdAt: string;
  updatedAt: string;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function stringifyFieldValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value);
}

function mapChangeLogRow(row: ProductChangeLogRow): InventoryProductChangeLogRecord {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name ?? '',
    article: row.article ?? '',
    barcode: row.barcode ?? '',
    fieldName: row.field_name,
    oldValue: row.old_value ?? '',
    newValue: row.new_value ?? '',
    changeSource: row.change_source,
    changedBy: row.changed_by ?? '',
    changeNote: row.change_note ?? '',
    createdAt: toIso(row.created_at)
  };
}

function mapImportReviewRow(row: ProductImportReviewRow): InventoryProductImportReviewRecord {
  return {
    id: row.id,
    productId: row.product_id,
    article: row.article ?? '',
    productName: row.product_name ?? '',
    existingBarcode: row.existing_barcode ?? '',
    incomingBarcode: row.incoming_barcode ?? '',
    issueType: row.issue_type,
    status: row.status,
    note: row.note ?? '',
    resolvedNote: row.resolved_note ?? '',
    resolvedBy: row.resolved_by ?? '',
    resolvedAt: toIso(row.resolved_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

export async function createInventoryProductFieldChangeLogsInDb(
  input: {
    productId: string | number;
    before: InventoryProductRecord;
    after: InventoryProductRecord;
    changeSource: string;
    changedBy?: string;
    changeNote?: string;
  },
  executor?: InventoryDbExecutor
) {
  const productId = Number(input.productId);
  if (!Number.isFinite(productId) || productId <= 0) return;

  const fields: Array<{ fieldName: string; beforeValue: unknown; afterValue: unknown }> = [
    { fieldName: 'article', beforeValue: input.before.article, afterValue: input.after.article },
    { fieldName: 'barcode', beforeValue: input.before.barcode, afterValue: input.after.barcode },
    { fieldName: 'product_name', beforeValue: input.before.productName, afterValue: input.after.productName },
    {
      fieldName: 'units_of_measurement',
      beforeValue: input.before.unitsOfMeasurement,
      afterValue: input.after.unitsOfMeasurement
    },
    { fieldName: 'category', beforeValue: input.before.category, afterValue: input.after.category },
    {
      fieldName: 'notified_days_default',
      beforeValue: input.before.notifiedDaysDefault,
      afterValue: input.after.notifiedDaysDefault
    },
    { fieldName: 'is_active', beforeValue: input.before.isActive, afterValue: input.after.isActive }
  ];

  const changes = fields
    .map((field) => ({
      fieldName: field.fieldName,
      oldValue: stringifyFieldValue(field.beforeValue),
      newValue: stringifyFieldValue(field.afterValue)
    }))
    .filter((field) => (field.oldValue ?? '') !== (field.newValue ?? ''));

  if (changes.length === 0) return;

  const db = executor ?? getDbPool();
  for (const change of changes) {
    await db.query(
      `
        INSERT INTO product_change_logs (
          product_id,
          field_name,
          old_value,
          new_value,
          change_source,
          changed_by,
          change_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        productId,
        change.fieldName,
        change.oldValue,
        change.newValue,
        input.changeSource,
        input.changedBy?.trim() || null,
        input.changeNote?.trim() || null
      ]
    );
  }
}

export async function queueInventoryProductImportReviewInDb(
  input: {
    productId?: number | null;
    article: string;
    productName: string;
    existingBarcode?: string | null;
    incomingBarcode?: string | null;
    issueType: string;
    note?: string;
  },
  executor?: InventoryDbExecutor
) {
  const db = executor ?? getDbPool();
  const [existingRows] = await db.query<ProductImportReviewRow[]>(
    `
      SELECT id, product_id, article, product_name, existing_barcode, incoming_barcode, issue_type, status, note, resolved_note, resolved_by, resolved_at, created_at, updated_at
      FROM product_import_review_queue
      WHERE status = 'pending'
        AND issue_type = ?
        AND article = ?
        AND COALESCE(existing_barcode, '') = ?
        AND COALESCE(incoming_barcode, '') = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [input.issueType, input.article.trim(), input.existingBarcode?.trim() || '', input.incomingBarcode?.trim() || '']
  );

  if (existingRows[0]) {
    await db.query(
      `
        UPDATE product_import_review_queue
        SET
          product_id = ?,
          product_name = ?,
          note = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        input.productId ?? null,
        input.productName.trim() || null,
        input.note?.trim() || null,
        existingRows[0].id
      ]
    );
    return existingRows[0].id;
  }

  const [result] = await db.query<ResultSetHeader>(
    `
      INSERT INTO product_import_review_queue (
        product_id,
        article,
        product_name,
        existing_barcode,
        incoming_barcode,
        issue_type,
        status,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `,
    [
      input.productId ?? null,
      input.article.trim() || null,
      input.productName.trim() || null,
      input.existingBarcode?.trim() || null,
      input.incomingBarcode?.trim() || null,
      input.issueType,
      input.note?.trim() || null
    ]
  );

  return result.insertId;
}

export async function listInventoryProductChangeLogsFromDb(limit = 50): Promise<InventoryProductChangeLogRecord[]> {
  const db = getDbPool();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const [rows] = await db.query<ProductChangeLogRow[]>(
    `
      SELECT
        pcl.id,
        pcl.product_id,
        p.product_name,
        p.article,
        (
          SELECT pb.barcode
          FROM product_barcodes pb
          WHERE pb.product_id = p.id
          ORDER BY pb.id ASC
          LIMIT 1
        ) AS barcode,
        pcl.field_name,
        pcl.old_value,
        pcl.new_value,
        pcl.change_source,
        pcl.changed_by,
        pcl.change_note,
        pcl.created_at
      FROM product_change_logs pcl
      INNER JOIN products p ON p.id = pcl.product_id
      ORDER BY pcl.created_at DESC, pcl.id DESC
      LIMIT ?
    `,
    [safeLimit]
  );

  return rows.map(mapChangeLogRow);
}

export async function listInventoryProductImportReviewItemsFromDb(
  status: 'pending' | 'resolved' | 'all' = 'pending',
  limit = 100
): Promise<InventoryProductImportReviewRecord[]> {
  const db = getDbPool();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const values: Array<string | number> = [];
  const whereSql =
    status === 'all'
      ? ''
      : `
        WHERE status = ?
      `;

  if (status !== 'all') {
    values.push(status);
  }
  values.push(safeLimit);

  const [rows] = await db.query<ProductImportReviewRow[]>(
    `
      SELECT
        id,
        product_id,
        article,
        product_name,
        existing_barcode,
        incoming_barcode,
        issue_type,
        status,
        note,
        resolved_note,
        resolved_by,
        resolved_at,
        created_at,
        updated_at
      FROM product_import_review_queue
      ${whereSql}
      ORDER BY
        CASE status WHEN 'pending' THEN 0 ELSE 1 END,
        updated_at DESC,
        id DESC
      LIMIT ?
    `,
    values
  );

  return rows.map(mapImportReviewRow);
}

export async function updateInventoryProductImportReviewStatusInDb(
  id: number,
  input: {
    status: 'pending' | 'resolved';
    resolvedBy?: string;
    resolvedNote?: string;
  },
  executor?: InventoryDbExecutor
) {
  const db = executor ?? getDbPool();
  await db.query(
    `
      UPDATE product_import_review_queue
      SET
        status = ?,
        resolved_by = ?,
        resolved_note = ?,
        resolved_at = CASE WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [input.status, input.resolvedBy?.trim() || null, input.resolvedNote?.trim() || null, input.status, id]
  );
}
