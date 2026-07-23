import { createHash, randomUUID } from 'crypto';

import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { findInventoryProductByBarcodeInDb, findInventoryProductByIdInDb, findInventoryProductDuplicateInDb } from '@/lib/inventory-products-repository';
import type {
  InventoryStoreAssortmentComparison,
  InventoryStoreAssortmentAllStoreComparison,
  InventoryStoreAssortmentAllStoreComparisonRow,
  InventoryStoreAssortmentImportRow,
  InventoryStoreAssortmentManualInput,
  InventoryStoreAssortmentRecord,
  InventoryStoreAssortmentSnapshot,
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

type SnapshotRow = RowDataPacket & {
  id: number;
  store_id: number;
  snapshot_date: Date | string;
  total_rows: number;
  present_rows: number;
  matched_rows: number;
  unmatched_rows: number;
  completion_percent: string | number;
  quantity_total: string | number | null;
  created_at: Date | string;
};

type AllStoreSummaryRow = RowDataPacket & {
  store_id: number;
  store_label: string;
  total_rows: number;
  present_rows: number;
  matched_rows: number;
  unmatched_rows: number;
  quantity_total: string | number | null;
};

const STORE_ASSORTMENT_SNAPSHOT_METRICS_VERSION = 2;

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

function formatDateOnly(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function normalizeSnapshotDate(value?: string | null) {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error('Некоректна дата зрізу асортименту.');
  }

  return raw;
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
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

function calculateCompletionPercent(matchedRows: number, presentRows: number) {
  if (presentRows <= 0) return 0;
  return Number(((matchedRows / presentRows) * 100).toFixed(2));
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
          KEY idx_store_inventory_assortment_store_present (store_id, is_present),
          KEY idx_store_inventory_assortment_store_match (store_id, match_status),
          KEY idx_store_inventory_assortment_store_product (store_id, product_id),
          KEY idx_store_inventory_assortment_store_present_product (store_id, is_present, product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS store_inventory_assortment_snapshots (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          store_id BIGINT UNSIGNED NOT NULL,
          snapshot_date DATE NOT NULL,
          total_rows INT NOT NULL DEFAULT 0,
          present_rows INT NOT NULL DEFAULT 0,
          matched_rows INT NOT NULL DEFAULT 0,
          unmatched_rows INT NOT NULL DEFAULT 0,
          completion_percent DECIMAL(7,2) NOT NULL DEFAULT 0,
          quantity_total DECIMAL(14,3) NOT NULL DEFAULT 0,
          metrics_version TINYINT UNSIGNED NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_store_inventory_assortment_snapshot (store_id, snapshot_date),
          KEY idx_store_inventory_assortment_snapshot_date (snapshot_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      const [snapshotColumns] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM store_inventory_assortment_snapshots');
      if (!snapshotColumns.some((column) => String(column.Field ?? '') === 'metrics_version')) {
        await pool.query('ALTER TABLE store_inventory_assortment_snapshots ADD COLUMN metrics_version TINYINT UNSIGNED NOT NULL DEFAULT 1');
      }

      const [indexes] = await pool.query<RowDataPacket[]>('SHOW INDEX FROM store_inventory_assortment');
      if (indexes.some((index) => String(index.Key_name ?? '') === 'uniq_store_inventory_assortment_identity')) {
        await pool.query('ALTER TABLE store_inventory_assortment DROP INDEX uniq_store_inventory_assortment_identity');
      }
      if (!indexes.some((index) => String(index.Key_name ?? '') === 'idx_store_inventory_assortment_store_present_product')) {
        await pool.query(
          'ALTER TABLE store_inventory_assortment ADD INDEX idx_store_inventory_assortment_store_present_product (store_id, is_present, product_id)'
        );
      }

      const [batchIndexes] = await pool.query<RowDataPacket[]>('SHOW INDEX FROM product_batches');
      if (!batchIndexes.some((index) => String(index.Key_name ?? '') === 'idx_product_batches_store_product')) {
        await pool.query('ALTER TABLE product_batches ADD INDEX idx_product_batches_store_product (store_id, product_id)');
      }
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

function mapStoreInventoryAssortmentSnapshotRow(row: SnapshotRow): InventoryStoreAssortmentSnapshot {
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    snapshotDate: formatDateOnly(row.snapshot_date),
    totalRows: Number(row.total_rows ?? 0),
    presentRows: Number(row.present_rows ?? 0),
    matchedRows: Number(row.matched_rows ?? 0),
    unmatchedRows: Number(row.unmatched_rows ?? 0),
    completionPercent: Number(row.completion_percent ?? 0),
    quantityTotal: Number(row.quantity_total ?? 0),
    createdAt: toIsoDateTime(row.created_at)
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
    identityHash?: string;
  }
) {
  const product = await resolveMatchingProduct(row, options.executor);
  const identityHash = options.identityHash ?? buildIdentityHash(row);
  const normalizedArticle = normalizeText(row.article);
  const normalizedBarcode = normalizeInventoryBarcode(row.barcode);
  const normalizedProductName = normalizeText(row.productName);
  const normalizedUnits = normalizeText(row.unitsOfMeasurement || product?.unitsOfMeasurement);
  const productId = product?.id ? Number(product.id) : null;
  const matchStatus = productId ? 'matched' : 'unmatched';

  const values = [
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
  ];

  if (options.sourceKind === 'manual') {
    const [updated] = await options.executor.query<ResultSetHeader>(
      `
        UPDATE store_inventory_assortment
        SET product_id = ?, article = ?, barcode = ?, product_name = ?, units_of_measurement = ?, quantity = ?,
            is_present = ?, match_status = ?, source_kind = ?, notes = ?, last_import_token = ?, imported_at = ?
        WHERE store_id = ? AND source_kind = 'manual' AND identity_hash = ?
        LIMIT 1
      `,
      [
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
        options.importToken ?? null,
        null,
        storeId,
        identityHash
      ]
    );
    if (updated.affectedRows > 0) return;
  }

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
    `,
    [storeId, ...values]
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

  const safeLimit = Math.min(Math.max(Number(options?.limit ?? 500), 1), 10000);
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
        SUM(CASE WHEN added_products.product_id IS NOT NULL THEN 1 ELSE 0 END) AS present_rows,
        SUM(CASE WHEN assortment.product_id IS NOT NULL THEN 1 ELSE 0 END) AS matched_rows,
        SUM(CASE WHEN added_products.product_id IS NULL THEN 1 ELSE 0 END) AS unmatched_rows,
        SUM(COALESCE(assortment.quantity, 0)) AS quantity_total
      FROM store_inventory_assortment AS assortment
      LEFT JOIN (
        SELECT DISTINCT product_id
        FROM product_batches
        WHERE store_id = ?
      ) AS added_products ON added_products.product_id = assortment.product_id
      WHERE assortment.store_id = ? AND assortment.is_present = 1
    `,
    [storeId, storeId]
  );

  const row = rows[0];
  const totalRows = Number(row?.total_rows ?? 0);
  const presentRows = Number(row?.present_rows ?? 0);
  const matchedRows = Number(row?.matched_rows ?? 0);

  return {
    totalRows,
    presentRows,
    matchedRows,
    unmatchedRows: Number(row?.unmatched_rows ?? 0),
    completionPercent: calculateCompletionPercent(presentRows, totalRows),
    quantityTotal: Number(row?.quantity_total ?? 0)
  };
}

export async function upsertStoreInventoryAssortmentSnapshotInDb(
  storeId: number,
  snapshotDate?: string | null
): Promise<InventoryStoreAssortmentSnapshot> {
  await ensureStoreInventoryAssortmentSchema();

  const normalizedStoreId = Number(storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
    throw new Error('Некоректний магазин для збереження зрізу.');
  }

  const dateKey = snapshotDate ? normalizeSnapshotDate(snapshotDate) : todayDateKey();
  const summary = await getStoreInventoryAssortmentSummaryFromDb(normalizedStoreId);

  await getDbPool().query(
    `
      INSERT INTO store_inventory_assortment_snapshots (
        store_id,
        snapshot_date,
        total_rows,
        present_rows,
        matched_rows,
        unmatched_rows,
        completion_percent,
        quantity_total,
        metrics_version
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_rows = VALUES(total_rows),
        present_rows = VALUES(present_rows),
        matched_rows = VALUES(matched_rows),
        unmatched_rows = VALUES(unmatched_rows),
        completion_percent = VALUES(completion_percent),
        quantity_total = VALUES(quantity_total),
        metrics_version = VALUES(metrics_version)
    `,
    [
      normalizedStoreId,
      dateKey,
      summary.totalRows,
      summary.presentRows,
      summary.matchedRows,
      summary.unmatchedRows,
      summary.completionPercent,
      summary.quantityTotal,
      STORE_ASSORTMENT_SNAPSHOT_METRICS_VERSION
    ]
  );

  const [rows] = await getDbPool().query<SnapshotRow[]>(
    `
      SELECT
        id,
        store_id,
        snapshot_date,
        total_rows,
        present_rows,
        matched_rows,
        unmatched_rows,
        completion_percent,
        quantity_total,
        created_at
      FROM store_inventory_assortment_snapshots
      WHERE store_id = ? AND snapshot_date = ? AND metrics_version = ?
      LIMIT 1
    `,
    [normalizedStoreId, dateKey, STORE_ASSORTMENT_SNAPSHOT_METRICS_VERSION]
  );

  if (!rows[0]) {
    throw new Error('Не вдалося зберегти зріз асортименту.');
  }

  return mapStoreInventoryAssortmentSnapshotRow(rows[0]);
}

export async function findStoreInventoryAssortmentSnapshotOnOrBeforeDateInDb(
  storeId: number,
  snapshotDate: string
): Promise<InventoryStoreAssortmentSnapshot | null> {
  await ensureStoreInventoryAssortmentSchema();

  const normalizedStoreId = Number(storeId);
  const dateKey = normalizeSnapshotDate(snapshotDate);
  const [rows] = await getDbPool().query<SnapshotRow[]>(
    `
      SELECT
        id,
        store_id,
        snapshot_date,
        total_rows,
        present_rows,
        matched_rows,
        unmatched_rows,
        completion_percent,
        quantity_total,
        created_at
      FROM store_inventory_assortment_snapshots
      WHERE store_id = ? AND snapshot_date <= ? AND metrics_version = ?
      ORDER BY snapshot_date DESC, id DESC
      LIMIT 1
    `,
    [normalizedStoreId, dateKey, STORE_ASSORTMENT_SNAPSHOT_METRICS_VERSION]
  );

  return rows[0] ? mapStoreInventoryAssortmentSnapshotRow(rows[0]) : null;
}

export async function listStoreInventoryAssortmentSnapshotsInDb(
  storeId: number,
  options?: { dateFrom?: string | null; dateTo?: string | null; limit?: number }
): Promise<InventoryStoreAssortmentSnapshot[]> {
  await ensureStoreInventoryAssortmentSchema();

  const normalizedStoreId = Number(storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
    return [];
  }

  const whereParts = ['store_id = ?', 'metrics_version = ?'];
  const values: Array<string | number> = [normalizedStoreId, STORE_ASSORTMENT_SNAPSHOT_METRICS_VERSION];
  if (options?.dateFrom) {
    whereParts.push('snapshot_date >= ?');
    values.push(normalizeSnapshotDate(options.dateFrom));
  }
  if (options?.dateTo) {
    whereParts.push('snapshot_date <= ?');
    values.push(normalizeSnapshotDate(options.dateTo));
  }

  const safeLimit = Math.min(Math.max(Number(options?.limit ?? 20), 1), 120);
  const [rows] = await getDbPool().query<SnapshotRow[]>(
    `
      SELECT
        id,
        store_id,
        snapshot_date,
        total_rows,
        present_rows,
        matched_rows,
        unmatched_rows,
        completion_percent,
        quantity_total,
        created_at
      FROM store_inventory_assortment_snapshots
      WHERE ${whereParts.join(' AND ')}
      ORDER BY snapshot_date DESC, id DESC
      LIMIT ?
    `,
    [...values, safeLimit]
  );

  return rows.map(mapStoreInventoryAssortmentSnapshotRow);
}

export async function getStoreInventoryAssortmentComparisonByDatesInDb(
  storeId: number,
  baselineDate: string,
  targetDate: string
): Promise<InventoryStoreAssortmentComparison> {
  await ensureStoreInventoryAssortmentSchema();

  const normalizedStoreId = Number(storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
    throw new Error('Некоректний магазин для порівняння.');
  }

  const requestedBaselineDate = normalizeSnapshotDate(baselineDate);
  const requestedTargetDate = normalizeSnapshotDate(targetDate);

  const baselineSnapshot = await findStoreInventoryAssortmentSnapshotOnOrBeforeDateInDb(
    normalizedStoreId,
    requestedBaselineDate
  );

  let targetSnapshot = await findStoreInventoryAssortmentSnapshotOnOrBeforeDateInDb(normalizedStoreId, requestedTargetDate);
  if (requestedTargetDate === todayDateKey()) {
    const currentSummary = await getStoreInventoryAssortmentSummaryFromDb(normalizedStoreId);
    targetSnapshot = {
      id: 'live',
      storeId: String(normalizedStoreId),
      snapshotDate: requestedTargetDate,
      createdAt: new Date().toISOString(),
      ...currentSummary
    };
  }

  const baseline = baselineSnapshot ?? {
    totalRows: 0,
    presentRows: 0,
    matchedRows: 0,
    unmatchedRows: 0,
    completionPercent: 0,
    quantityTotal: 0
  };
  const target = targetSnapshot ?? baseline;

  return {
    requestedBaselineDate,
    requestedTargetDate,
    baselineSnapshot,
    targetSnapshot,
    delta: {
      totalRows: Number((target.totalRows - baseline.totalRows).toFixed(3)),
      presentRows: Number((target.presentRows - baseline.presentRows).toFixed(3)),
      matchedRows: Number((target.matchedRows - baseline.matchedRows).toFixed(3)),
      unmatchedRows: Number((target.unmatchedRows - baseline.unmatchedRows).toFixed(3)),
      completionPercent: Number((target.completionPercent - baseline.completionPercent).toFixed(2)),
      quantityTotal: Number((target.quantityTotal - baseline.quantityTotal).toFixed(3))
    }
  };
}

export async function getAllStoreInventoryAssortmentComparisonByDatesInDb(
  baselineDate: string,
  targetDate: string
): Promise<InventoryStoreAssortmentAllStoreComparison> {
  await ensureStoreInventoryAssortmentSchema();

  const requestedBaselineDate = normalizeSnapshotDate(baselineDate);
  const requestedTargetDate = normalizeSnapshotDate(targetDate);
  const pool = getDbPool();

  const [summaryRows] = await pool.query<AllStoreSummaryRow[]>(
    `
      SELECT
        s.id AS store_id,
        CONCAT_WS(' | ', s.store_code, s.city, s.address_line) AS store_label,
        COUNT(assortment.id) AS total_rows,
        COALESCE(SUM(CASE WHEN added_products.product_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS present_rows,
        COALESCE(SUM(CASE WHEN assortment.product_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS matched_rows,
        COALESCE(SUM(CASE WHEN added_products.product_id IS NULL THEN 1 ELSE 0 END), 0) AS unmatched_rows,
        COALESCE(SUM(assortment.quantity), 0) AS quantity_total
      FROM stores s
      LEFT JOIN store_inventory_assortment assortment
        ON assortment.store_id = s.id AND assortment.is_present = 1
      LEFT JOIN (
        SELECT DISTINCT store_id, product_id
        FROM product_batches
      ) added_products
        ON added_products.store_id = s.id AND added_products.product_id = assortment.product_id
      WHERE s.is_active = 1
      GROUP BY s.id, s.store_code, s.city, s.address_line
      ORDER BY s.sort_order ASC, s.city ASC, s.address_line ASC, s.id ASC
    `
  );

  const [snapshotRows] = await pool.query<SnapshotRow[]>(
    `
      SELECT
        id,
        store_id,
        snapshot_date,
        total_rows,
        present_rows,
        matched_rows,
        unmatched_rows,
        completion_percent,
        quantity_total,
        created_at
      FROM store_inventory_assortment_snapshots
      WHERE metrics_version = ?
        AND snapshot_date <= ?
      ORDER BY store_id ASC, snapshot_date DESC, id DESC
    `,
    [STORE_ASSORTMENT_SNAPSHOT_METRICS_VERSION, requestedBaselineDate > requestedTargetDate ? requestedBaselineDate : requestedTargetDate]
  );

  const latestSnapshotByDate = (date: string) => {
    const result = new Map<string, InventoryStoreAssortmentSnapshot>();
    for (const row of snapshotRows) {
      const snapshot = mapStoreInventoryAssortmentSnapshotRow(row);
      if (snapshot.snapshotDate <= date && !result.has(snapshot.storeId)) {
        result.set(snapshot.storeId, snapshot);
      }
    }
    return result;
  };

  const baselineSnapshots = latestSnapshotByDate(requestedBaselineDate);
  const targetSnapshots = latestSnapshotByDate(requestedTargetDate);
  const liveSummaries = new Map<string, InventoryStoreAssortmentSnapshot>();
  for (const row of summaryRows) {
    const totalRows = Number(row.total_rows ?? 0);
    const presentRows = Number(row.present_rows ?? 0);
    liveSummaries.set(String(row.store_id), {
      id: 'live',
      storeId: String(row.store_id),
      snapshotDate: requestedTargetDate,
      totalRows,
      presentRows,
      matchedRows: Number(row.matched_rows ?? 0),
      unmatchedRows: Number(row.unmatched_rows ?? 0),
      completionPercent: calculateCompletionPercent(presentRows, totalRows),
      quantityTotal: Number(row.quantity_total ?? 0),
      createdAt: new Date().toISOString()
    });
  }

  const zeroSnapshot = (storeId: string, date: string): InventoryStoreAssortmentSnapshot => ({
    id: 'empty',
    storeId,
    snapshotDate: date,
    totalRows: 0,
    presentRows: 0,
    matchedRows: 0,
    unmatchedRows: 0,
    completionPercent: 0,
    quantityTotal: 0,
    createdAt: ''
  });

  const rows: InventoryStoreAssortmentAllStoreComparisonRow[] = summaryRows.map((store) => {
    const storeId = String(store.store_id);
    const baseline = baselineSnapshots.get(storeId) ?? zeroSnapshot(storeId, requestedBaselineDate);
    const target = requestedTargetDate === todayDateKey()
      ? liveSummaries.get(storeId) ?? zeroSnapshot(storeId, requestedTargetDate)
      : targetSnapshots.get(storeId) ?? zeroSnapshot(storeId, requestedTargetDate);
    return {
      storeId,
      storeLabel: store.store_label ?? `Магазин ${storeId}`,
      baseline,
      target,
      delta: {
        totalRows: target.totalRows - baseline.totalRows,
        presentRows: target.presentRows - baseline.presentRows,
        matchedRows: target.matchedRows - baseline.matchedRows,
        unmatchedRows: target.unmatchedRows - baseline.unmatchedRows,
        completionPercent: Number((target.completionPercent - baseline.completionPercent).toFixed(2)),
        quantityTotal: target.quantityTotal - baseline.quantityTotal
      }
    };
  });

  const sum = (selector: (snapshot: InventoryStoreAssortmentSnapshot) => number, target: boolean) =>
    rows.reduce((total, row) => total + selector(target ? row.target : row.baseline), 0);
  const baselineTotalRows = sum((snapshot) => snapshot.totalRows, false);
  const targetTotalRows = sum((snapshot) => snapshot.totalRows, true);
  const baselinePresentRows = sum((snapshot) => snapshot.presentRows, false);
  const targetPresentRows = sum((snapshot) => snapshot.presentRows, true);
  const baselineMatchedRows = sum((snapshot) => snapshot.matchedRows, false);
  const targetMatchedRows = sum((snapshot) => snapshot.matchedRows, true);
  const baselineUnmatchedRows = sum((snapshot) => snapshot.unmatchedRows, false);
  const targetUnmatchedRows = sum((snapshot) => snapshot.unmatchedRows, true);
  const baselineQuantity = sum((snapshot) => snapshot.quantityTotal, false);
  const targetQuantity = sum((snapshot) => snapshot.quantityTotal, true);

  return {
    requestedBaselineDate,
    requestedTargetDate,
    rows,
    totals: {
      storeCount: rows.length,
      totalRows: targetTotalRows - baselineTotalRows,
      presentRows: targetPresentRows - baselinePresentRows,
      matchedRows: targetMatchedRows - baselineMatchedRows,
      unmatchedRows: targetUnmatchedRows - baselineUnmatchedRows,
      completionPercent: Number(
        (calculateCompletionPercent(targetPresentRows, targetTotalRows) - calculateCompletionPercent(baselinePresentRows, baselineTotalRows)).toFixed(2)
      ),
      quantityTotal: targetQuantity - baselineQuantity
    }
  };
}

export async function importStoreInventoryAssortmentFromRows(
  storeId: number,
  rows: InventoryStoreAssortmentImportRow[]
): Promise<{
  parsedRows: number;
  uniqueRows: number;
  duplicateRows: number;
  importedCount: number;
  matchedCount: number;
  unmatchedCount: number;
}> {
  await ensureStoreInventoryAssortmentSchema();

  const connection = await getDbPool().getConnection();
  const importToken = randomUUID();
  const uniqueIdentityHashes = new Set<string>();

  for (const row of rows) {
    uniqueIdentityHashes.add(buildIdentityHash(row));
  }

  try {
    await connection.beginTransaction();

    for (const [rowIndex, row] of rows.entries()) {
      await upsertStoreInventoryAssortmentRow(storeId, row, {
        sourceKind: 'import',
        executor: connection,
        isPresent: true,
        importToken,
        identityHash: createHash('sha256').update(`${buildIdentityHash(row)}|import:${importToken}|row:${rowIndex}`).digest('hex')
      });
    }

    await connection.query(
      `
        UPDATE store_inventory_assortment
        SET is_present = 0
        WHERE store_id = ?
          AND source_kind = 'import'
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

  const summary = await getStoreInventoryAssortmentSummaryFromDb(storeId);

  return {
    parsedRows: rows.length,
    uniqueRows: uniqueIdentityHashes.size,
    duplicateRows: Math.max(0, rows.length - uniqueIdentityHashes.size),
    importedCount: summary.presentRows,
    matchedCount: summary.matchedRows,
    unmatchedCount: summary.unmatchedRows
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
      WHERE store_id = ? AND source_kind = 'manual' AND identity_hash = ?
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

export async function clearStoreInventoryAssortmentInDb(storeId: number): Promise<number> {
  await ensureStoreInventoryAssortmentSchema();

  const normalizedStoreId = Number(storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
    throw new Error('Некоректний магазин для очищення асортименту.');
  }

  const [result] = await getDbPool().query<ResultSetHeader>(
    `
      DELETE FROM store_inventory_assortment
      WHERE store_id = ?
    `,
    [normalizedStoreId]
  );

  return Number(result.affectedRows ?? 0);
}
