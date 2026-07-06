import { createHash, randomUUID } from 'crypto';

import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { findInventoryProductByBarcodeInDb, findInventoryProductByIdInDb, findInventoryProductDuplicateInDb } from '@/lib/inventory-products-repository';
import type {
  InventoryStoreAssortmentImportRow,
  InventoryStoreAssortmentManualInput,
  InventoryStoreAssortmentRecord,
  InventoryStoreAssortmentSummary,
  InventoryStoreAssortmentUpdateInput
} from '@/lib/inventory-store-assortment-types';
import { normalizeInventoryBarcode } from '@/lib/inventory-product-types';

type InventoryDbExecutor = Pool | PoolConnection;

type StoreInventoryAssortmentRow = RowDataPacket & {
  id: number;
  store_id: number;
  product_id: number | null;
  article: string | null;
  barcode: string | null;
  product_name: string | null;
  units_of_measurement: string | null;
  quantity: string | number | null;
  is_present: number;
  match_status: 'matched' | 'unmatched';
  source_kind: 'import' | 'manual';
  notes: string | null;
  imported_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type SummaryRow = RowDataPacket & {
  total_rows: number;
  present_rows: number;
  matched_rows: number;
  unmatched_rows: number;
  quantity_total: string | number | null;
};

let storeInventoryAssortmentSchemaPromise: Promise<void> | null = null;

function toIsoDateTime(value: Date | string | null | undefined) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toQuantity(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function buildIdentityHash(input: { article?: string; barcode?: string; productName?: string }) {
  const barcode = normalizeInventoryBarcode(input.barcode);
  if (barcode) {
    return createHash('sha256').update(`barcode:${barcode}`).digest('hex');
  }

  const article = normalizeText(input.article).toLowerCase();
  const productName = normalizeText(input.productName).toLowerCase();
  return createHash('sha256').update(`article:${article}|name:${productName}`).digest('hex');
}

async function ensureStoreInventoryAssortmentSchema() {
  if (!storeInventoryAssortmentSchemaPromise) {
    storeInventoryAssortmentSchemaPromise = (async () => {
      const pool = getDbPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS store_inventory_assortment (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          store_id BIGINT UNSIGNED NOT NULL,
          product_id BIGINT UNSIGNED NULL,
          article VARCHAR(128) NOT NULL DEFAULT '',
          barcode VARCHAR(128) NOT NULL DEFAULT '',
          product_name VARCHAR(255) NOT NULL DEFAULT '',
          units_of_measurement VARCHAR(64) NOT NULL DEFAULT '',
          quantity DECIMAL(14,3) NULL,
          is_present TINYINT(1) NOT NULL DEFAULT 1,
          match_status VARCHAR(24) NOT NULL DEFAULT 'unmatched',
          source_kind VARCHAR(24) NOT NULL DEFAULT 'import',
          notes TEXT NULL,
          identity_hash CHAR(64) NOT NULL,
          last_import_token CHAR(36) NULL,
          imported_at DATETIME NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_store_inventory_assortment_identity (store_id, identity_hash),
          KEY idx_store_inventory_assortment_store_present (store_id, is_present),
          KEY idx_store_inventory_assortment_store_match (store_id, match_status),
          KEY idx_store_inventory_assortment_store_product (store_id, product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })().catch((error) => {
      storeInventoryAssortmentSchemaPromise = null;
      throw error;
    });
  }

  await storeInventoryAssortmentSchemaPromise;
}

function mapStoreInventoryAssortmentRow(row: StoreInventoryAssortmentRow): InventoryStoreAssortmentRecord {
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    productId: row.product_id == null ? '' : String(row.product_id),
    article: row.article ?? '',
    barcode: row.barcode ?? '',
    productName: row.product_name ?? '',
    unitsOfMeasurement: row.units_of_measurement ?? '',
    quantity: toQuantity(row.quantity),
    isPresent: row.is_present === 1,
    matchStatus: row.match_status,
    sourceKind: row.source_kind,
    notes: row.notes ?? '',
    importedAt: toIsoDateTime(row.imported_at),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at)
  };
}

async function resolveMatchingProduct(
  input: { article?: string; barcode?: string; productName?: string },
  executor?: InventoryDbExecutor
) {
  const barcode = normalizeInventoryBarcode(input.barcode);
  if (barcode) {
    const byBarcode = await findInventoryProductByBarcodeInDb(barcode, executor);
    if (byBarcode) return byBarcode;
  }

  const byIdentity = await findInventoryProductDuplicateInDb(
    {
      article: normalizeText(input.article),
      barcode,
      productName: normalizeText(input.productName)
    },
    executor
  );
  return byIdentity;
}

async function upsertStoreInventoryAssortmentRow(
  storeId: number,
  row: InventoryStoreAssortmentImportRow,
  options: {
    sourceKind: 'import' | 'manual';
    executor: InventoryDbExecutor;
    isPresent: boolean;
    notes?: string;
    importToken?: string | null;
  }
) {
  const product = await resolveMatchingProduct(row, options.executor);
  const identityHash = buildIdentityHash(row);
  const normalizedArticle = normalizeText(row.article);
  const normalizedBarcode = normalizeInventoryBarcode(row.barcode);
  const normalizedProductName = normalizeText(row.productName);
  const normalizedUnits = normalizeText(row.unitsOfMeasurement || product?.unitsOfMeasurement);
  const productId = product?.id ? Number(product.id) : null;
  const matchStatus = productId ? 'matched' : 'unmatched';

  await options.executor.query(
    `
      INSERT INTO store_inventory_assortment (
        store_id,
        product_id,
        article,
        barcode,
        product_name,
        units_of_measurement,
        quantity,
        is_present,
        match_status,
        source_kind,
        notes,
        identity_hash,
        last_import_token,
        imported_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        product_id = VALUES(product_id),
        article = VALUES(article),
        barcode = VALUES(barcode),
        product_name = VALUES(product_name),
        units_of_measurement = VALUES(units_of_measurement),
        quantity = VALUES(quantity),
        is_present = VALUES(is_present),
        match_status = VALUES(match_status),
        source_kind = VALUES(source_kind),
        notes = VALUES(notes),
        last_import_token = VALUES(last_import_token),
        imported_at = VALUES(imported_at)
    `,
    [
      storeId,
      productId,
      normalizedArticle,
      normalizedBarcode,
      normalizedProductName,
      normalizedUnits,
      row.quantity,
      options.isPresent ? 1 : 0,
      matchStatus,
      options.sourceKind,
      normalizeText(options.notes),
      identityHash,
      options.importToken ?? null,
      options.sourceKind === 'import' ? new Date() : null
    ]
  );
}

export async function listStoreInventoryAssortmentFromDb(
  storeId: number,
  options?: { query?: string; present?: 'all' | 'present' | 'missing'; status?: 'all' | 'matched' | 'unmatched'; limit?: number }
): Promise<InventoryStoreAssortmentRecord[]> {
  await ensureStoreInventoryAssortmentSchema();

  const pool = getDbPool();
  const whereParts = ['store_id = ?'];
  const values: Array<string | number> = [storeId];

  const query = normalizeText(options?.query);
  if (query) {
    const like = `%${query}%`;
    whereParts.push('(product_name LIKE ? OR article LIKE ? OR barcode LIKE ?)');
    values.push(like, like, like);
  }

  if (options?.present === 'present') {
    whereParts.push('is_present = 1');
  } else if (options?.present === 'missing') {
    whereParts.push('is_present = 0');
  }

  if (options?.status === 'matched' || options?.status === 'unmatched') {
    whereParts.push('match_status = ?');
    values.push(options.status);
  }

  const safeLimit = Math.min(Math.max(Number(options?.limit ?? 500), 1), 1000);
  const [rows] = await pool.query<StoreInventoryAssortmentRow[]>(
    `
      SELECT
        id,
        store_id,
        product_id,
        article,
        barcode,
        product_name,
        units_of_measurement,
        quantity,
        is_present,
        match_status,
        source_kind,
        notes,
        imported_at,
        created_at,
        updated_at
      FROM store_inventory_assortment
      WHERE ${whereParts.join(' AND ')}
      ORDER BY is_present DESC, match_status ASC, product_name ASC, id DESC
      LIMIT ?
    `,
    [...values, safeLimit]
  );

  return rows.map(mapStoreInventoryAssortmentRow);
}

export async function getStoreInventoryAssortmentSummaryFromDb(storeId: number): Promise<InventoryStoreAssortmentSummary> {
  await ensureStoreInventoryAssortmentSchema();

  const pool = getDbPool();
  const [rows] = await pool.query<SummaryRow[]>(
    `
      SELECT
        COUNT(*) AS total_rows,
        SUM(CASE WHEN is_present = 1 THEN 1 ELSE 0 END) AS present_rows,
        SUM(CASE WHEN is_present = 1 AND match_status = 'matched' THEN 1 ELSE 0 END) AS matched_rows,
        SUM(CASE WHEN is_present = 1 AND match_status = 'unmatched' THEN 1 ELSE 0 END) AS unmatched_rows,
        SUM(CASE WHEN is_present = 1 THEN COALESCE(quantity, 0) ELSE 0 END) AS quantity_total
      FROM store_inventory_assortment
      WHERE store_id = ?
    `,
    [storeId]
  );

  const row = rows[0];
  const presentRows = Number(row?.present_rows ?? 0);
  const matchedRows = Number(row?.matched_rows ?? 0);

  return {
    totalRows: Number(row?.total_rows ?? 0),
    presentRows,
    matchedRows,
    unmatchedRows: Number(row?.unmatched_rows ?? 0),
    completionPercent: presentRows > 0 ? Math.round((matchedRows / presentRows) * 100) : 0,
    quantityTotal: Number(row?.quantity_total ?? 0)
  };
}

export async function importStoreInventoryAssortmentFromRows(
  storeId: number,
  rows: InventoryStoreAssortmentImportRow[]
): Promise<{ importedCount: number; matchedCount: number; unmatchedCount: number }> {
  await ensureStoreInventoryAssortmentSchema();

  const connection = await getDbPool().getConnection();
  const importToken = randomUUID();

  try {
    await connection.beginTransaction();

    for (const row of rows) {
      await upsertStoreInventoryAssortmentRow(storeId, row, {
        sourceKind: 'import',
        executor: connection,
        isPresent: true,
        importToken
      });
    }

    await connection.query(
      `
        UPDATE store_inventory_assortment
        SET is_present = 0
        WHERE store_id = ?
          AND (last_import_token IS NULL OR last_import_token <> ?)
      `,
      [storeId, importToken]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const items = await listStoreInventoryAssortmentFromDb(storeId, { present: 'all', status: 'all', limit: 2000 });
  const presentItems = items.filter((item) => item.isPresent);

  return {
    importedCount: presentItems.length,
    matchedCount: presentItems.filter((item) => item.matchStatus === 'matched').length,
    unmatchedCount: presentItems.filter((item) => item.matchStatus === 'unmatched').length
  };
}

export async function addManualStoreInventoryAssortmentItemInDb(
  storeId: number,
  input: InventoryStoreAssortmentManualInput
): Promise<InventoryStoreAssortmentRecord> {
  await ensureStoreInventoryAssortmentSchema();

  const productId = Number(input.productId);
  if (!Number.isFinite(productId) || productId <= 0) {
    throw new Error('Некоректний товар каталогу.');
  }

  const product = await findInventoryProductByIdInDb(productId);
  if (!product) {
    throw new Error('Товар каталогу не знайдено.');
  }

  const quantity = input.quantity == null ? null : Number(input.quantity);
  if (quantity != null && !Number.isFinite(quantity)) {
    throw new Error('Некоректна кількість товару.');
  }

  await upsertStoreInventoryAssortmentRow(
    storeId,
    {
      article: product.article,
      barcode: product.barcodes[0] ?? product.barcode,
      productName: product.productName,
      unitsOfMeasurement: product.unitsOfMeasurement,
      quantity
    },
    {
      sourceKind: 'manual',
      executor: getDbPool(),
      isPresent: input.isPresent !== false,
      notes: input.notes
    }
  );

  const identityHash = buildIdentityHash({
    article: product.article,
    barcode: product.barcodes[0] ?? product.barcode,
    productName: product.productName
  });
  const [rows] = await getDbPool().query<StoreInventoryAssortmentRow[]>(
    `
      SELECT
        id,
        store_id,
        product_id,
        article,
        barcode,
        product_name,
        units_of_measurement,
        quantity,
        is_present,
        match_status,
        source_kind,
        notes,
        imported_at,
        created_at,
        updated_at
      FROM store_inventory_assortment
      WHERE store_id = ? AND identity_hash = ?
      LIMIT 1
    `,
    [storeId, identityHash]
  );

  if (!rows[0]) {
    throw new Error('Не вдалося зберегти товар магазину.');
  }

  return mapStoreInventoryAssortmentRow(rows[0]);
}

export async function updateStoreInventoryAssortmentItemInDb(
  storeId: number,
  input: InventoryStoreAssortmentUpdateInput
): Promise<InventoryStoreAssortmentRecord | null> {
  await ensureStoreInventoryAssortmentSchema();

  const itemId = Number(input.itemId);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    throw new Error('Некоректний запис асортименту.');
  }

  const connection = await getDbPool().getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query<StoreInventoryAssortmentRow[]>(
      `
        SELECT
          id,
          store_id,
          product_id,
          article,
          barcode,
          product_name,
          units_of_measurement,
          quantity,
          is_present,
          match_status,
          source_kind,
          notes,
          imported_at,
          created_at,
          updated_at
        FROM store_inventory_assortment
        WHERE id = ? AND store_id = ?
        LIMIT 1
      `,
      [itemId, storeId]
    );
    const existing = existingRows[0];
    if (!existing) {
      await connection.rollback();
      return null;
    }

    let productId = existing.product_id;
    let article = existing.article ?? '';
    let barcode = existing.barcode ?? '';
    let productName = existing.product_name ?? '';
    let unitsOfMeasurement = existing.units_of_measurement ?? '';

    if (input.productId !== undefined && input.productId !== null && input.productId !== '') {
      const product = await findInventoryProductByIdInDb(input.productId, connection);
      if (!product) {
        throw new Error('Товар каталогу не знайдено.');
      }
      productId = Number(product.id);
      article = product.article;
      barcode = product.barcodes[0] ?? product.barcode;
      productName = product.productName;
      unitsOfMeasurement = product.unitsOfMeasurement;
    }

    const quantity = input.quantity === undefined ? toQuantity(existing.quantity) : input.quantity == null ? null : Number(input.quantity);
    if (quantity != null && !Number.isFinite(quantity)) {
      throw new Error('Некоректна кількість товару.');
    }

    const isPresent = input.isPresent === undefined ? existing.is_present === 1 : input.isPresent;
    const notes = input.notes === undefined ? existing.notes ?? '' : normalizeText(input.notes);
    const nextMatchStatus = productId ? 'matched' : 'unmatched';

    await connection.query(
      `
        UPDATE store_inventory_assortment
        SET
          product_id = ?,
          article = ?,
          barcode = ?,
          product_name = ?,
          units_of_measurement = ?,
          quantity = ?,
          is_present = ?,
          match_status = ?,
          notes = ?
        WHERE id = ? AND store_id = ?
      `,
      [productId, article, barcode, productName, unitsOfMeasurement, quantity, isPresent ? 1 : 0, nextMatchStatus, notes, itemId, storeId]
    );

    const [updatedRows] = await connection.query<StoreInventoryAssortmentRow[]>(
      `
        SELECT
          id,
          store_id,
          product_id,
          article,
          barcode,
          product_name,
          units_of_measurement,
          quantity,
          is_present,
          match_status,
          source_kind,
          notes,
          imported_at,
          created_at,
          updated_at
        FROM store_inventory_assortment
        WHERE id = ? AND store_id = ?
        LIMIT 1
      `,
      [itemId, storeId]
    );

    await connection.commit();
    return updatedRows[0] ? mapStoreInventoryAssortmentRow(updatedRows[0]) : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
