import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  createInventoryProductFieldChangeLogsInDb,
  queueInventoryProductImportReviewInDb
} from '@/lib/inventory-product-audit-repository';
import {
  normalizeInventoryBarcode,
  parseInventoryBarcodeEntries,
  normalizeInventoryProductInput,
  type InventoryBarcodeEntry,
  type InventoryProductInput,
  type InventoryProductRecord
} from '@/lib/inventory-product-types';

type ProductRow = RowDataPacket & {
  id: number;
  article: string;
  barcode_list?: string | null;
  barcode_entry_list?: string | null;
  product_name: string;
  category: string | null;
  default_units_of_measurement: string | null;
  notified_days_default: number | null;
  is_active: number;
  approval_status: string | null;
  created_source: string | null;
  approval_requested_at: Date | string | null;
  approved_at: Date | string | null;
  approved_by_user_id: number | null;
  approval_note: string | null;
  matched_units_of_measurement?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InventoryProductApprovalAction = 'approve' | 'reject' | 'update';

export type InventoryProductApprovalReviewRecord = {
  id: number;
  productId: number;
  action: InventoryProductApprovalAction;
  oldValuesJson: string;
  newValuesJson: string;
  note: string;
  reviewedByUserId: number | null;
  createdAt: string;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function mapRow(row: ProductRow): InventoryProductRecord {
  const barcodeEntries = parseInventoryBarcodeEntries(
    undefined,
    '',
    String(row.barcode_entry_list ?? '')
      .split(',')
      .map((item) => {
        const trimmed = item.trim();
        if (!trimmed) return null;
        const separatorIndex = trimmed.lastIndexOf('::');
        if (separatorIndex === -1) {
          return { barcode: trimmed, unitsOfMeasurement: '' };
        }

        return {
          barcode: trimmed.slice(0, separatorIndex),
          unitsOfMeasurement: trimmed.slice(separatorIndex + 2)
        };
      })
      .filter(Boolean)
  );
  const barcodes = barcodeEntries.map((item) => item.barcode);

  return {
    id: String(row.id),
    article: row.article,
    barcode: barcodes[0] ?? '',
    barcodes,
    barcodeEntries,
    productName: row.product_name,
    unitsOfMeasurement:
      String(row.matched_units_of_measurement ?? '').trim() ||
      String(row.default_units_of_measurement ?? '').trim() ||
      barcodeEntries[0]?.unitsOfMeasurement ||
      '',
    category: row.category ?? '',
    notifiedDaysDefault: Number(row.notified_days_default ?? 7),
    isActive: row.is_active === 1,
    approvalStatus: String(row.approval_status ?? 'approved').trim() || 'approved',
    createdSource: String(row.created_source ?? 'admin').trim() || 'admin',
    approvalRequestedAt: toIso(row.approval_requested_at),
    approvedAt: toIso(row.approved_at),
    approvedByUserId: row.approved_by_user_id ? String(row.approved_by_user_id) : '',
    approvalNote: String(row.approval_note ?? ''),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

type InventoryDbExecutor = Pool | PoolConnection;

function buildProductsSelectSql(
  whereSql = '',
  orderSql = 'ORDER BY p.product_name ASC, p.id DESC',
  limitSql = '',
  extraSelectSql = ''
) {
  return `
      SELECT
        p.id,
        p.article,
        GROUP_CONCAT(DISTINCT pb.barcode ORDER BY pb.id ASC SEPARATOR ',') AS barcode_list,
        GROUP_CONCAT(DISTINCT CONCAT(pb.barcode, '::', COALESCE(pb.units_of_measurement, '')) ORDER BY pb.id ASC SEPARATOR ',') AS barcode_entry_list,
        p.product_name,
        p.category,
        p.default_units_of_measurement,
        p.notified_days_default,
        p.is_active,
        p.approval_status,
        p.created_source,
        p.approval_requested_at,
        p.approved_at,
        p.approved_by_user_id,
        p.approval_note,
        ${extraSelectSql ? `${extraSelectSql},` : ''}
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id
      ${whereSql}
      GROUP BY
        p.id,
        p.article,
        p.product_name,
        p.category,
        p.default_units_of_measurement,
        p.notified_days_default,
        p.is_active,
        p.approval_status,
        p.created_source,
        p.approval_requested_at,
        p.approved_at,
        p.approved_by_user_id,
        p.approval_note,
        p.created_at,
        p.updated_at
      ${orderSql}
      ${limitSql}
  `;
}

async function replaceInventoryProductBarcodesInDb(
  productId: number,
  barcodeEntries: InventoryBarcodeEntry[],
  executor: InventoryDbExecutor
) {
  const normalizedEntries = barcodeEntries.filter((item) => item.barcode);
  const barcodes = normalizedEntries.map((item) => item.barcode);
  if (barcodes.length > 0) {
    const placeholders = barcodes.map(() => '?').join(', ');
    const [conflicts] = await executor.query<Array<RowDataPacket & { barcode: string; product_id: number }>>(
      `
        SELECT barcode, product_id
        FROM product_barcodes
        WHERE barcode IN (${placeholders})
          AND product_id <> ?
        LIMIT 1
      `,
      [...barcodes, productId]
    );

    if (conflicts[0]) {
      throw new Error(`Штрихкод ${conflicts[0].barcode} уже прив'язаний до іншого товару.`);
    }
  }

  await executor.query('DELETE FROM product_barcodes WHERE product_id = ?', [productId]);

  for (const entry of normalizedEntries) {
    await executor.query(
      `
        INSERT INTO product_barcodes (product_id, barcode, units_of_measurement)
        VALUES (?, ?, ?)
      `,
      [productId, entry.barcode, entry.unitsOfMeasurement || null]
    );
  }
}

async function findInventoryProductRowByIdInDb(productId: number, executor: InventoryDbExecutor) {
  const [rows] = await executor.query<ProductRow[]>(
    buildProductsSelectSql('WHERE p.id = ?', 'ORDER BY p.id ASC', 'LIMIT 1'),
    [productId]
  );

  return rows[0] ?? null;
}

async function listInventoryProductBarcodeEntriesInDb(productId: number, executor: InventoryDbExecutor) {
  const [rows] = await executor.query<Array<RowDataPacket & InventoryBarcodeEntry>>(
    `
      SELECT barcode, COALESCE(units_of_measurement, '') AS unitsOfMeasurement
      FROM product_barcodes
      WHERE product_id = ?
      ORDER BY id ASC
    `,
    [productId]
  );

  return rows.map((row) => ({
    barcode: normalizeInventoryBarcode(row.barcode),
    unitsOfMeasurement: String(row.unitsOfMeasurement ?? '').trim()
  }));
}

async function hasManualInventoryProductCreationInDb(productId: number, executor: InventoryDbExecutor) {
  const [rows] = await executor.query<Array<RowDataPacket & { id: number }>>(
    `
      SELECT id
      FROM activity_logs
      WHERE product_id = ?
        AND action_type = 'product_created_from_telegram_intake'
      ORDER BY id DESC
      LIMIT 1
    `,
    [productId]
  );

  return Boolean(rows[0]);
}

async function findInventoryProductBarcodeConflictForImportInDb(
  productId: number,
  barcodeEntries: InventoryBarcodeEntry[],
  executor: InventoryDbExecutor
) {
  const barcodes = barcodeEntries.filter((item) => item.barcode).map((item) => item.barcode);
  if (barcodes.length === 0) return null;

  const placeholders = barcodes.map(() => '?').join(', ');
  const [rows] = await executor.query<
    Array<
      RowDataPacket & {
        barcode: string;
        product_id: number;
        article: string | null;
        product_name: string | null;
      }
    >
  >(
    `
      SELECT pb.barcode, pb.product_id, p.article, p.product_name
      FROM product_barcodes pb
      INNER JOIN products p ON p.id = pb.product_id
      WHERE pb.barcode IN (${placeholders})
        AND pb.product_id <> ?
      ORDER BY pb.id ASC
      LIMIT 1
    `,
    [...barcodes, productId]
  );

  return rows[0] ?? null;
}

export async function mergeInventoryProductsInDb(
  input: {
    sourceProductId: number;
    targetProductId: number;
    changeSource?: string;
    changedBy?: string;
    changeNote?: string;
  },
  executor?: InventoryDbExecutor
) {
  const sourceProductId = Number(input.sourceProductId);
  const targetProductId = Number(input.targetProductId);
  if (!Number.isFinite(sourceProductId) || sourceProductId <= 0) {
    throw new Error('Invalid source product id.');
  }
  if (!Number.isFinite(targetProductId) || targetProductId <= 0) {
    throw new Error('Invalid target product id.');
  }
  if (sourceProductId === targetProductId) {
    throw new Error('Source and target products must be different.');
  }

  const db = executor ?? getDbPool();
  const sourceRow = await findInventoryProductRowByIdInDb(sourceProductId, db);
  const targetRow = await findInventoryProductRowByIdInDb(targetProductId, db);
  if (!sourceRow || !targetRow) {
    throw new Error('Не вдалося знайти один із товарів для об’єднання.');
  }

  const beforeTargetRecord = mapRow(targetRow);
  const sourceBarcodeEntries = await listInventoryProductBarcodeEntriesInDb(sourceProductId, db);
  const targetBarcodeEntries = await listInventoryProductBarcodeEntriesInDb(targetProductId, db);
  const nextBarcodeEntriesMap = new Map<string, InventoryBarcodeEntry>();

  for (const entry of targetBarcodeEntries) {
    nextBarcodeEntriesMap.set(entry.barcode, entry);
  }
  for (const entry of sourceBarcodeEntries) {
    if (!entry.barcode) continue;
    if (!nextBarcodeEntriesMap.has(entry.barcode)) {
      nextBarcodeEntriesMap.set(entry.barcode, entry);
    }
  }

  const nextBarcodeEntries = Array.from(nextBarcodeEntriesMap.values());

  await db.query('UPDATE product_batches SET product_id = ? WHERE product_id = ?', [targetProductId, sourceProductId]);
  await db.query('UPDATE activity_logs SET product_id = ? WHERE product_id = ?', [targetProductId, sourceProductId]);
  await db.query('UPDATE notification_logs SET product_id = ? WHERE product_id = ?', [targetProductId, sourceProductId]);
  await db.query('UPDATE product_change_logs SET product_id = ? WHERE product_id = ?', [targetProductId, sourceProductId]);
  await db.query('UPDATE product_import_review_queue SET product_id = ? WHERE product_id = ?', [targetProductId, sourceProductId]);

  await replaceInventoryProductBarcodesInDb(targetProductId, nextBarcodeEntries, db);
  await db.query('DELETE FROM product_barcodes WHERE product_id = ?', [sourceProductId]);
  await db.query('DELETE FROM products WHERE id = ?', [sourceProductId]);

  const afterTargetRecord = await findInventoryProductByIdInDb(targetProductId, db);
  if (!afterTargetRecord) {
    throw new Error('Не вдалося прочитати товар після об’єднання.');
  }

  await createInventoryProductFieldChangeLogsInDb(
    {
      productId: targetProductId,
      before: beforeTargetRecord,
      after: afterTargetRecord,
      changeSource: input.changeSource?.trim() || 'product_merge',
      changedBy: input.changedBy?.trim() || '',
      changeNote:
        input.changeNote?.trim() ||
        `Merged duplicate product #${sourceProductId} into product #${targetProductId}.`
    },
    db
  );

  return {
    targetProduct: afterTargetRecord,
    mergedBarcodeEntries: nextBarcodeEntries.length,
    transferredBarcodeEntries: sourceBarcodeEntries.length
  };
}

export type InventoryProductImportRow = {
  article: string;
  barcode: string;
  productName: string;
  unitsOfMeasurement: string;
  category?: string;
  notifiedDaysDefault?: number;
  isActive?: boolean;
};

export type InventoryProductImportLogItem = {
  rowNumber: number;
  article: string;
  productName: string;
  barcode: string;
  unitsOfMeasurement: string;
  status: 'created' | 'updated' | 'skipped' | 'review';
  message: string;
};

export type InventoryProductImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  needsReview: number;
  total: number;
  productsCreated: number;
  productsUpdated: number;
  productsMatchedExisting: number;
  barcodeEntriesAdded: number;
  barcodeEntriesKept: number;
  invalidRows: number;
  log: InventoryProductImportLogItem[];
};

function buildInventoryProductIdentityWhereSql() {
  return `
    p.article = ?
    AND p.product_name = ?
  `;
}

function buildInventoryProductsWhereSql(query = '', category = '') {
  const trimmedQuery = query.trim();
  const trimmedCategory = category.trim();
  const whereParts: string[] = [];
  const values: string[] = [];

  if (trimmedQuery) {
    const like = `%${trimmedQuery}%`;
    whereParts.push(
      "(p.article LIKE ? OR p.product_name LIKE ? OR COALESCE(p.category, '') LIKE ? OR EXISTS (SELECT 1 FROM product_barcodes pb2 WHERE pb2.product_id = p.id AND pb2.barcode LIKE ?))"
    );
    values.push(like, like, like, like);
  }

  if (trimmedCategory) {
    whereParts.push("COALESCE(p.category, '') = ?");
    values.push(trimmedCategory);
  }

  return {
    whereSql: whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '',
    values
  };
}

export async function listInventoryProductsFromDb(
  query = '',
  limit = 200,
  offset = 0,
  category = ''
): Promise<InventoryProductRecord[]> {
  const pool = getDbPool();
  const { whereSql, values } = buildInventoryProductsWhereSql(query, category);
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const safeOffset = Math.max(offset, 0);

  const [rows] = await pool.query<ProductRow[]>(
    buildProductsSelectSql(whereSql, 'ORDER BY p.product_name ASC, p.id DESC', 'LIMIT ? OFFSET ?'),
    [...values, safeLimit, safeOffset]
  );

  return rows.map(mapRow);
}

export async function countInventoryProductsInDb(query = '', category = ''): Promise<number> {
  const pool = getDbPool();
  const { whereSql, values } = buildInventoryProductsWhereSql(query, category);

  const [rows] = await pool.query<Array<RowDataPacket & { total_count: number }>>(
    `
      SELECT COUNT(*) AS total_count
      FROM products p
      ${whereSql}
    `,
    values
  );

  return Number(rows[0]?.total_count ?? 0);
}

export async function listInventoryProductCategoriesFromDb(): Promise<string[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<Array<RowDataPacket & { category: string | null }>>(
    `
      SELECT DISTINCT category
      FROM products p
      WHERE p.category IS NOT NULL AND TRIM(p.category) <> ''
      ORDER BY p.category ASC
    `
  );

  return rows.map((row) => String(row.category ?? '').trim()).filter(Boolean);
}

export async function findInventoryProductByIdInDb(
  productId: string | number,
  executor?: InventoryDbExecutor
): Promise<InventoryProductRecord | null> {
  const db = executor ?? getDbPool();
  const [rows] = await db.query<ProductRow[]>(
    buildProductsSelectSql('WHERE p.id = ?', 'ORDER BY p.id ASC', 'LIMIT 1'),
    [productId]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findInventoryProductByBarcodeInDb(
  barcode: string,
  executor?: InventoryDbExecutor
): Promise<InventoryProductRecord | null> {
  const normalizedBarcode = normalizeInventoryBarcode(barcode);
  if (!normalizedBarcode) return null;

  const db = executor ?? getDbPool();
  const [rows] = await db.query<ProductRow[]>(
    buildProductsSelectSql(
      'WHERE EXISTS (SELECT 1 FROM product_barcodes pb2 WHERE pb2.product_id = p.id AND REPLACE(TRIM(COALESCE(pb2.barcode, \'\')), \' \', \'\') = ?)',
      'ORDER BY p.is_active DESC, p.id ASC',
      'LIMIT 1',
      'MAX(CASE WHEN REPLACE(TRIM(COALESCE(pb.barcode, \'\')), \' \', \'\') = ? THEN pb.units_of_measurement ELSE NULL END) AS matched_units_of_measurement'
    ),
    [normalizedBarcode, normalizedBarcode]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findInventoryProductDuplicateInDb(
  input: { article?: string; barcode?: string; productName?: string; unitsOfMeasurement?: string },
  executor?: InventoryDbExecutor
): Promise<InventoryProductRecord | null> {
  const article = String(input.article ?? '').trim();
  const barcode = normalizeInventoryBarcode(input.barcode);
  const productName = String(input.productName ?? '').trim();
  const hasIdentity = Boolean(article && productName);
  if (!hasIdentity && !barcode) return null;

  const db = executor ?? getDbPool();
  const whereParts: string[] = [];
  const values: Array<string> = [];

  if (hasIdentity) {
    whereParts.push(`(${buildInventoryProductIdentityWhereSql()})`);
    values.push(article, productName);
  }
  if (barcode) {
    whereParts.push(
      "EXISTS (SELECT 1 FROM product_barcodes pb2 WHERE pb2.product_id = p.id AND REPLACE(TRIM(COALESCE(pb2.barcode, '')), ' ', '') = ?)"
    );
    values.push(barcode);
  }

  const [rows] = await db.query<ProductRow[]>(
    buildProductsSelectSql(`WHERE ${whereParts.join(' OR ')}`, 'ORDER BY p.id ASC', 'LIMIT 1'),
    values
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

async function createInventoryProductApprovalReviewInDb(
  input: {
    productId: number;
    action: InventoryProductApprovalAction;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    note?: string;
    reviewedByUserId?: number | null;
  },
  executor?: InventoryDbExecutor
) {
  const db = executor ?? getDbPool();
  await db.query(
    `
      INSERT INTO product_approval_reviews (
        product_id,
        action,
        old_values_json,
        new_values_json,
        note,
        reviewed_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      input.productId,
      input.action,
      JSON.stringify(input.oldValues ?? {}),
      JSON.stringify(input.newValues ?? {}),
      input.note?.trim() || null,
      input.reviewedByUserId ?? null
    ]
  );
}

export async function createInventoryProductInDb(
  input: InventoryProductInput,
  executor?: InventoryDbExecutor,
  options?: {
    approvalStatus?: string;
    createdSource?: string;
    approvalRequestedAt?: string | Date | null;
    approvedAt?: string | Date | null;
    approvedByUserId?: number | null;
    approvalNote?: string;
  }
): Promise<InventoryProductRecord> {
  const normalized = normalizeInventoryProductInput(input);
  const db = executor ?? getDbPool();
  const duplicate = await findInventoryProductDuplicateInDb(
    {
      article: normalized.article,
      barcode: normalized.barcode,
      productName: normalized.productName
    },
    db
  );

  if (duplicate) {
    throw new Error(`Товар уже існує в базі: ${duplicate.productName}.`);
  }

  const [result] = await db.query<ResultSetHeader>(
    `
      INSERT INTO products (
        article,
        product_name,
        category,
        default_units_of_measurement,
        notified_days_default,
        is_active,
        approval_status,
        created_source,
        approval_requested_at,
        approved_at,
        approved_by_user_id,
        approval_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      normalized.article,
      normalized.productName,
      normalized.category || null,
      normalized.barcodeEntries.length === 0 ? normalized.unitsOfMeasurement || null : null,
      normalized.notifiedDaysDefault,
      normalized.isActive ? 1 : 0,
      options?.approvalStatus?.trim() || 'approved',
      options?.createdSource?.trim() || 'admin',
      options?.approvalRequestedAt ?? null,
      options?.approvedAt ?? null,
      options?.approvedByUserId ?? null,
      options?.approvalNote?.trim() || null
    ]
  );

  const [rows] = await db.query<ProductRow[]>(
    buildProductsSelectSql('WHERE p.id = ?', 'ORDER BY p.id ASC', 'LIMIT 1'),
    [result.insertId]
  );

  if (rows.length === 0) {
    throw new Error('Не вдалося прочитати створений товар.');
  }

  await replaceInventoryProductBarcodesInDb(result.insertId, normalized.barcodeEntries ?? [], db);
  const created = await findInventoryProductByIdInDb(result.insertId, db);
  if (!created) {
    throw new Error('Не вдалося прочитати створений товар.');
  }

  return created;
}

export async function updateInventoryProductInDb(
  productId: string | number,
  input: InventoryProductInput,
  executor?: InventoryDbExecutor,
  options?: {
    changeSource?: string;
    changedBy?: string;
    approvalStatus?: string;
    approvalNote?: string;
    approvedAt?: string | Date | null;
    approvedByUserId?: number | null;
  }
): Promise<InventoryProductRecord> {
  const normalized = normalizeInventoryProductInput(input);
  const db = executor ?? getDbPool();
  const numericProductId = Number(productId);
  if (!Number.isFinite(numericProductId) || numericProductId <= 0) {
    throw new Error('Invalid product id.');
  }

  const currentRow = await findInventoryProductRowByIdInDb(numericProductId, db);
  if (!currentRow) {
    throw new Error('Товар не знайдено.');
  }

  const duplicate = await findInventoryProductDuplicateInDb(
    {
      article: normalized.article,
      barcode: normalized.barcode,
      productName: normalized.productName,
      unitsOfMeasurement: normalized.unitsOfMeasurement
    },
    db
  );
  if (duplicate && Number(duplicate.id) !== numericProductId) {
    throw new Error(`Товар уже існує в базі: ${duplicate.productName}.`);
  }

  const beforeRecord = mapRow(currentRow);
  const currentBarcodeEntries = await listInventoryProductBarcodeEntriesInDb(numericProductId, db);
  const nextBarcodeEntries =
    normalized.barcodeEntries.length > 0
      ? normalized.barcodeEntries
      : currentBarcodeEntries.filter((entry) => entry.barcode);

  const nextDefaultUnitsOfMeasurement =
    normalized.barcodeEntries.length === 0 ? normalized.unitsOfMeasurement || null : null;

  await db.query(
    `
      UPDATE products
      SET
        article = ?,
        product_name = ?,
        category = ?,
        default_units_of_measurement = ?,
        notified_days_default = ?,
        is_active = ?,
        approval_status = COALESCE(?, approval_status),
        approval_note = ?,
        approved_at = ?,
        approved_by_user_id = ?
      WHERE id = ?
    `,
    [
      normalized.article,
      normalized.productName,
      normalized.category || null,
      nextDefaultUnitsOfMeasurement,
      normalized.notifiedDaysDefault,
      normalized.isActive ? 1 : 0,
      options?.approvalStatus ?? null,
      options?.approvalNote?.trim() || null,
      options?.approvedAt ?? null,
      options?.approvedByUserId ?? null,
      numericProductId
    ]
  );

  await replaceInventoryProductBarcodesInDb(numericProductId, nextBarcodeEntries, db);
  const afterRecord = await findInventoryProductByIdInDb(numericProductId, db);
  if (!afterRecord) {
    throw new Error('Не вдалося прочитати оновлений товар.');
  }

  await createInventoryProductFieldChangeLogsInDb(
    {
      productId: numericProductId,
      before: beforeRecord,
      after: afterRecord,
      changeSource: options?.changeSource?.trim() || 'admin_product_review',
      changedBy: options?.changedBy?.trim() || '',
      changeNote:
        options?.approvalNote?.trim() ||
        `Product updated during approval workflow (${options?.approvalStatus?.trim() || 'update'}).`
    },
    db
  );

  return afterRecord;
}

export async function updateInventoryProductApprovalInDb(
  input: {
    productId: number;
    action: InventoryProductApprovalAction;
    reviewedByUserId?: number | null;
    changedBy?: string;
    note?: string;
    product?: InventoryProductInput | null;
  },
  executor?: InventoryDbExecutor
): Promise<InventoryProductRecord> {
  const db = executor ?? getDbPool();
  const product = await findInventoryProductByIdInDb(input.productId, db);
  if (!product) {
    throw new Error('Товар не знайдено.');
  }

  const beforeSnapshot = product as Record<string, unknown>;
  let nextRecord = product;
  const trimmedNote = input.note?.trim() || '';

  if (input.product) {
    nextRecord = await updateInventoryProductInDb(
      input.productId,
      input.product,
      db,
      {
        changeSource: 'admin_product_review',
        changedBy: input.changedBy,
        approvalStatus: input.action === 'approve' ? 'approved' : input.action === 'reject' ? 'rejected' : undefined,
        approvalNote: trimmedNote || product.approvalNote,
        approvedAt: input.action === 'approve' ? new Date() : null,
        approvedByUserId: input.action === 'approve' ? input.reviewedByUserId ?? null : null
      }
    );
  } else {
    const nextStatus =
      input.action === 'approve'
        ? 'approved'
        : input.action === 'reject'
          ? 'rejected'
          : product.approvalStatus || 'pending';
    await db.query(
      `
        UPDATE products
        SET
          approval_status = ?,
          approval_note = ?,
          approved_at = ?,
          approved_by_user_id = ?
        WHERE id = ?
      `,
      [
        nextStatus,
        trimmedNote || null,
        input.action === 'approve' ? new Date() : null,
        input.action === 'approve' ? input.reviewedByUserId ?? null : null,
        input.productId
      ]
    );
    nextRecord = (await findInventoryProductByIdInDb(input.productId, db)) ?? product;
  }

  try {
    await createInventoryProductApprovalReviewInDb(
      {
        productId: input.productId,
        action: input.action,
        oldValues: beforeSnapshot,
        newValues: nextRecord as Record<string, unknown>,
        note: trimmedNote,
        reviewedByUserId: input.reviewedByUserId ?? null
      },
      db
    );
  } catch (error) {
    console.error('Failed to write product approval review audit record', {
      productId: input.productId,
      action: input.action,
      error
    });
  }

  return nextRecord;
}

export async function importInventoryProductsToDb(
  rows: InventoryProductImportRow[],
  executor?: InventoryDbExecutor,
  options?: {
    changedBy?: string;
    changeSource?: string;
  }
): Promise<InventoryProductImportSummary> {
  const db = executor ?? getDbPool();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let needsReview = 0;
  let productsCreated = 0;
  let productsUpdated = 0;
  let productsMatchedExisting = 0;
  let barcodeEntriesAdded = 0;
  let barcodeEntriesKept = 0;
  let invalidRows = 0;
  const log: InventoryProductImportLogItem[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1;
    try {
    const normalized = normalizeInventoryProductInput({
      article: row.article,
      barcode: row.barcode,
      productName: row.productName,
      unitsOfMeasurement: row.unitsOfMeasurement,
      category: row.category ?? '',
      notifiedDaysDefault: row.notifiedDaysDefault ?? 7,
      isActive: row.isActive !== false
    });

    if (!normalized.article || !normalized.productName || !normalized.unitsOfMeasurement) {
      skipped += 1;
      invalidRows += 1;
      log.push({
        rowNumber,
        article: normalized.article,
        productName: normalized.productName,
        barcode: normalized.barcode,
        unitsOfMeasurement: normalized.unitsOfMeasurement,
        status: 'skipped',
        message: 'Рядок пропущено: не вистачає артикулу, назви товару або одиниці вимірювання.'
      });
      continue;
    }

    const [identityRows] = await db.query<ProductRow[]>(
      buildProductsSelectSql(`WHERE ${buildInventoryProductIdentityWhereSql()}`, 'ORDER BY p.id ASC', 'LIMIT 1'),
      [normalized.article, normalized.productName]
    );

    let identityMatch = identityRows[0] ?? null;
    let barcodeMatch: ProductRow | null = null;

    if (normalized.barcode) {
      const [barcodeRows] = await db.query<ProductRow[]>(
        buildProductsSelectSql(
          'WHERE EXISTS (SELECT 1 FROM product_barcodes pb2 WHERE pb2.product_id = p.id AND pb2.barcode = ?)',
          'ORDER BY p.id ASC',
          'LIMIT 1'
        ),
        [normalized.barcode]
      );
      barcodeMatch = barcodeRows[0] ?? null;
    }

    let existing = identityMatch ?? barcodeMatch;
    let mergedManualDuplicate = false;

    if (!existing) {
      await createInventoryProductInDb(normalized, db);
      created += 1;
      productsCreated += 1;
      barcodeEntriesAdded += normalized.barcodeEntries?.length ?? 0;
      log.push({
        rowNumber,
        article: normalized.article,
        productName: normalized.productName,
        barcode: normalized.barcode,
        unitsOfMeasurement: normalized.unitsOfMeasurement,
        status: 'created',
        message: `Створено новий товар і додано баркодів: ${normalized.barcodeEntries?.length ?? 0}.`
      });
      continue;
    }

    productsMatchedExisting += 1;

    if (
      normalized.barcode &&
      identityMatch &&
      barcodeMatch &&
      identityMatch.id !== barcodeMatch.id
    ) {
      const canAutoMergeManualDuplicate = await hasManualInventoryProductCreationInDb(barcodeMatch.id, db);
      if (canAutoMergeManualDuplicate) {
        await mergeInventoryProductsInDb(
          {
            sourceProductId: barcodeMatch.id,
            targetProductId: identityMatch.id,
            changeSource: options?.changeSource?.trim() || 'excel_import',
            changedBy: options?.changedBy?.trim() || '',
            changeNote: `Auto-merged manual duplicate product during import for barcode ${normalized.barcode}.`
          },
          db
        );

        const refreshedIdentityMatch = await findInventoryProductRowByIdInDb(identityMatch.id, db);
        if (!refreshedIdentityMatch) {
          throw new Error('Не вдалося прочитати товар після автоматичного об’єднання дубля.');
        }

        identityMatch = refreshedIdentityMatch;
        barcodeMatch = refreshedIdentityMatch;
        existing = refreshedIdentityMatch;
        mergedManualDuplicate = true;
      } else {
        await queueInventoryProductImportReviewInDb(
          {
            productId: identityMatch.id,
            article: identityMatch.article,
            productName: identityMatch.product_name,
            existingBarcode: barcodeMatch.barcode,
            incomingBarcode: normalized.barcode,
            issueType: 'barcode_conflict',
            note: 'The imported product identity matches one product, but the barcode is already attached to another product.'
          },
          db
        );
        skipped += 1;
        needsReview += 1;
        log.push({
          rowNumber,
          article: normalized.article,
          productName: normalized.productName,
          barcode: normalized.barcode,
          unitsOfMeasurement: normalized.unitsOfMeasurement,
          status: 'review',
          message: 'Потрібна перевірка: цей товар знайдено, але баркод уже прив’язаний до іншого товару.'
        });
        continue;
      }
    }

    if (false) {
      log.push({
        rowNumber,
        article: normalized.article,
        productName: normalized.productName,
        barcode: normalized.barcode,
        unitsOfMeasurement: normalized.unitsOfMeasurement,
        status: 'updated',
        message: 'Знайдено вручну створений дубль, виконано автоматичне об’єднання з основним товаром.'
      });
    }

    if (
      normalized.barcode &&
      identityMatch &&
      barcodeMatch &&
      identityMatch.id !== barcodeMatch.id
    ) {
      await queueInventoryProductImportReviewInDb(
        {
          productId: identityMatch.id,
          article: identityMatch.article,
          productName: identityMatch.product_name,
          existingBarcode: barcodeMatch.barcode,
          incomingBarcode: normalized.barcode,
          issueType: 'barcode_conflict',
          note: 'The imported product identity matches one product, but the barcode is already attached to another product.'
        },
        db
      );
      skipped += 1;
      needsReview += 1;
      log.push({
        rowNumber,
        article: normalized.article,
        productName: normalized.productName,
        barcode: normalized.barcode,
        unitsOfMeasurement: normalized.unitsOfMeasurement,
        status: 'review',
        message: 'Потрібна перевірка: цей товар знайдено, але баркод уже привʼязаний до іншого товару.'
      });
      continue;
    }

    if (!identityMatch && barcodeMatch) {
      await queueInventoryProductImportReviewInDb(
        {
          productId: barcodeMatch.id,
          article: normalized.article,
          productName: normalized.productName,
          existingBarcode: barcodeMatch.barcode,
          incomingBarcode: normalized.barcode,
          issueType: 'product_identity_conflict',
          note: 'The imported barcode already exists, but article/name/unit identify a different product.'
        },
        db
      );
      skipped += 1;
      needsReview += 1;
      log.push({
        rowNumber,
        article: normalized.article,
        productName: normalized.productName,
        barcode: normalized.barcode,
        unitsOfMeasurement: normalized.unitsOfMeasurement,
        status: 'review',
        message: 'Потрібна перевірка: баркод уже існує, але артикул і назва вказують на інший товар.'
      });
      continue;
    }

    const beforeRecord = mapRow(existing);
    const existingBarcodeEntries = (beforeRecord.barcodeEntries ?? []) as InventoryBarcodeEntry[];
    const nextBarcodeEntriesMap = new Map<string, InventoryBarcodeEntry>();
    for (const entry of existingBarcodeEntries) {
      nextBarcodeEntriesMap.set(entry.barcode, entry);
    }
    for (const entry of normalized.barcodeEntries ?? []) {
      nextBarcodeEntriesMap.set(entry.barcode, entry);
    }
    const nextBarcodeEntries = Array.from(nextBarcodeEntriesMap.values());
    const nextBarcodes = nextBarcodeEntries.map((item: InventoryBarcodeEntry) => item.barcode);
    const nextBarcode = nextBarcodes[0] ?? null;
    const barcodeSetConflict = await findInventoryProductBarcodeConflictForImportInDb(existing.id, nextBarcodeEntries, db);
    if (barcodeSetConflict) {
      await queueInventoryProductImportReviewInDb(
        {
          productId: existing.id,
          article: normalized.article,
          productName: normalized.productName,
          existingBarcode: barcodeSetConflict.barcode,
          incomingBarcode: normalized.barcode,
          issueType: 'barcode_conflict',
          note: `The product update was skipped because barcode ${barcodeSetConflict.barcode} already belongs to product #${barcodeSetConflict.product_id}. The conflict was found in the current barcode set stored in the database.`
        },
        db
      );
      skipped += 1;
      needsReview += 1;
      log.push({
        rowNumber,
        article: normalized.article,
        productName: normalized.productName,
        barcode: normalized.barcode,
        unitsOfMeasurement: normalized.unitsOfMeasurement,
        status: 'review',
        message: `Потрібна перевірка: під час оновлення товару виявлено конфліктний баркод ${barcodeSetConflict.barcode}, який уже прив’язаний до іншого товару в базі.`
      });
      continue;
    }
    const nextDefaultUnitsOfMeasurement =
      normalized.barcodeEntries.length === 0
        ? normalized.unitsOfMeasurement
        : String(existing.default_units_of_measurement ?? '').trim();
    const existingBarcodeEntrySignature = existingBarcodeEntries
      .map((item: InventoryBarcodeEntry) => `${item.barcode}:${item.unitsOfMeasurement}`)
      .join('|');
    const nextBarcodeEntrySignature = nextBarcodeEntries
      .map((item: InventoryBarcodeEntry) => `${item.barcode}:${item.unitsOfMeasurement}`)
      .join('|');
    const addedBarcodeCount = Math.max(nextBarcodeEntries.length - existingBarcodeEntries.length, 0);
    const keptBarcodeCount = nextBarcodeEntries.length - addedBarcodeCount;
    const hasChanges =
      mergedManualDuplicate ||
      existing.article !== normalized.article ||
      (existing.barcode ?? '') !== (nextBarcode ?? '') ||
      existingBarcodeEntrySignature !== nextBarcodeEntrySignature ||
      existing.product_name !== normalized.productName ||
      (existing.category ?? '') !== normalized.category ||
      String(existing.default_units_of_measurement ?? '').trim() !== nextDefaultUnitsOfMeasurement ||
      Number(existing.notified_days_default ?? 7) !== normalized.notifiedDaysDefault ||
      existing.is_active !== (normalized.isActive ? 1 : 0);

    if (!hasChanges) {
      skipped += 1;
      barcodeEntriesKept += existingBarcodeEntries.length;
      log.push({
        rowNumber,
        article: normalized.article,
        productName: normalized.productName,
        barcode: normalized.barcode,
        unitsOfMeasurement: normalized.unitsOfMeasurement,
        status: 'skipped',
        message: 'Рядок пропущено: товар і баркод уже є в базі без нових змін.'
      });
      continue;
    }
    await db.query(
      `
        UPDATE products
        SET
          article = ?,
          product_name = ?,
          category = ?,
          default_units_of_measurement = ?,
          notified_days_default = ?,
          is_active = ?
        WHERE id = ?
      `,
      [
        normalized.article,
        normalized.productName,
        normalized.category || null,
        nextDefaultUnitsOfMeasurement || null,
        normalized.notifiedDaysDefault,
        normalized.isActive ? 1 : 0,
        existing.id
      ]
    );
    const afterRecord = {
      ...beforeRecord,
      article: normalized.article,
      barcode: nextBarcode ?? '',
      barcodes: nextBarcodes,
      barcodeEntries: nextBarcodeEntries,
      productName: normalized.productName,
      unitsOfMeasurement: nextDefaultUnitsOfMeasurement || beforeRecord.unitsOfMeasurement,
      category: normalized.category,
      notifiedDaysDefault: normalized.notifiedDaysDefault,
      isActive: normalized.isActive
    };
    await createInventoryProductFieldChangeLogsInDb(
      {
        productId: existing.id,
        before: beforeRecord,
        after: afterRecord,
        changeSource: options?.changeSource?.trim() || 'excel_import',
        changedBy: options?.changedBy?.trim() || ''
      },
      db
    );
    await replaceInventoryProductBarcodesInDb(existing.id, nextBarcodeEntries, db);
    updated += 1;
    productsUpdated += 1;
    barcodeEntriesAdded += addedBarcodeCount;
    barcodeEntriesKept += keptBarcodeCount;
    log.push({
      rowNumber,
      article: normalized.article,
      productName: normalized.productName,
      barcode: normalized.barcode,
      unitsOfMeasurement: normalized.unitsOfMeasurement,
      status: 'updated',
      message:
        mergedManualDuplicate
          ? `Оновлено існуючий товар, автоматично об’єднано вручну створений дубль і додано нових баркодів: ${addedBarcodeCount}.`
          : addedBarcodeCount > 0
          ? `Оновлено існуючий товар, додано нових баркодів: ${addedBarcodeCount}.`
          : 'Оновлено існуючий товар без додавання нових баркодів.'
    });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Невідома помилка імпорту.';
      throw new Error(`Рядок ${rowNumber}: ${message}`);
    }
  }

  return {
    created,
    updated,
    skipped,
    needsReview,
    total: rows.length,
    productsCreated,
    productsUpdated,
    productsMatchedExisting,
    barcodeEntriesAdded,
    barcodeEntriesKept,
    invalidRows,
    log
  };
}
