import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import type { InventorySaleImportRow } from '@/lib/inventory-sales-xlsx-import';

type FefoBatchRow = RowDataPacket & {
  id: number;
  product_id: number;
  store_id: number;
  quantity_current: number | string;
  batch_status: string | null;
  expiry_date: string;
};

type ProductLookupRow = RowDataPacket & {
  id: number;
  article: string;
  product_name: string;
};

type StoreLookupRow = RowDataPacket & {
  id: number;
  store_code: string | null;
  name: string | null;
  city: string | null;
  address_line: string | null;
};

export type InventoryFefoSaleAllocation = {
  batchId: number;
  soldQuantity: number;
  expiryDate: string;
};

type SaleImportRowStatus = 'imported' | 'skipped' | 'failed';

export type InventorySaleImportRowResult = {
  rowNumber: number;
  externalSaleId: string;
  status: SaleImportRowStatus;
  article: string;
  productName: string;
  quantity: number;
  soldAt: string;
  message: string;
  allocations: InventoryFefoSaleAllocation[];
};

export type InventorySaleImportResult = {
  fileName: string;
  saleSource: string;
  dryRun: boolean;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  importedQuantity: number;
  rows: InventorySaleImportRowResult[];
};

function normalizeQuantity(value: unknown): number {
  const quantity = Number(value ?? 0);
  return Number.isFinite(quantity) ? Math.max(Math.round(quantity * 1000) / 1000, 0) : 0;
}

function normalizeExternalPart(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, '/');
}

function buildExternalSaleId(row: InventorySaleImportRow): string {
  return [
    normalizeExternalPart(row.storeLabel),
    normalizeExternalPart(row.cashRegister),
    normalizeExternalPart(row.receiptNumber),
    normalizeExternalPart(row.article),
    normalizeExternalPart(row.soldAt),
    normalizeExternalPart(row.quantity),
    normalizeExternalPart(row.lineTotal)
  ].join('|');
}

export async function applyInventoryFefoSaleInDb(input: {
  productId: string | number;
  storeId: string | number;
  quantity: number;
  saleSource?: string;
  externalSaleId?: string | null;
  soldAt?: string | null;
}) {
  const productId = Number(input.productId);
  const storeId = Number(input.storeId);
  const quantity = normalizeQuantity(input.quantity);
  const saleSource = String(input.saleSource ?? 'manual').trim() || 'manual';
  const externalSaleId = String(input.externalSaleId ?? '').trim() || null;
  const soldAt = String(input.soldAt ?? '').trim() || null;

  if (!Number.isFinite(productId) || productId <= 0) {
    throw new Error('Некоректний productId для FEFO-списання.');
  }
  if (!Number.isFinite(storeId) || storeId <= 0) {
    throw new Error('Некоректний storeId для FEFO-списання.');
  }
  if (quantity <= 0) {
    throw new Error('Кількість для FEFO-списання має бути більшою за 0.');
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await applyInventoryFefoSaleWithConnection(connection, {
      productId,
      storeId,
      quantity,
      saleSource,
      externalSaleId,
      soldAt
    });
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function importInventorySalesRowsInDb(input: {
  fileName: string;
  rows: InventorySaleImportRow[];
  saleSource?: string;
  dryRun?: boolean;
}): Promise<InventorySaleImportResult> {
  const fileName = String(input.fileName ?? '').trim() || 'sales.xlsx';
  const saleSource = String(input.saleSource ?? 'pos-xlsx').trim() || 'pos-xlsx';
  const dryRun = Boolean(input.dryRun);
  const resultRows: InventorySaleImportRowResult[] = [];

  if (dryRun) {
    return previewInventorySalesRowsInDb({
      fileName,
      rows: input.rows,
      saleSource
    });
  }

  for (const row of input.rows) {
    const externalSaleId = buildExternalSaleId(row);
    const quantity = normalizeQuantity(row.quantity);

    try {
      const result = await importInventorySalesRowInDb({
        fileName,
        saleSource,
        externalSaleId,
        row: {
          ...row,
          quantity
        }
      });
      resultRows.push(result);
    } catch (error) {
      resultRows.push({
        rowNumber: row.rowNumber,
        externalSaleId,
        status: 'failed',
        article: row.article,
        productName: row.productName,
        quantity,
        soldAt: row.soldAt,
        message: error instanceof Error ? error.message : 'Не вдалося імпортувати рядок продажу.',
        allocations: []
      });
    }
  }

  const importedRows = resultRows.filter((row) => row.status === 'imported').length;
  const skippedRows = resultRows.filter((row) => row.status === 'skipped').length;
  const failedRows = resultRows.filter((row) => row.status === 'failed').length;
  const importedQuantity = resultRows
    .filter((row) => row.status === 'imported')
    .reduce((sum, row) => sum + row.quantity, 0);

  return {
    fileName,
    saleSource,
    dryRun,
    totalRows: input.rows.length,
    importedRows,
    skippedRows,
    failedRows,
    importedQuantity: Math.round(importedQuantity * 1000) / 1000,
    rows: resultRows
  };
}

async function previewInventorySalesRowsInDb(input: {
  fileName: string;
  rows: InventorySaleImportRow[];
  saleSource: string;
}): Promise<InventorySaleImportResult> {
  const pool = getDbPool();
  const connection = await pool.getConnection();
  const simulatedBatchesByProductStore = new Map<string, FefoBatchRow[]>();
  const resultRows: InventorySaleImportRowResult[] = [];

  try {
    for (const row of input.rows) {
      const quantity = normalizeQuantity(row.quantity);
      const normalizedRow = { ...row, quantity };
      const externalSaleId = buildExternalSaleId(normalizedRow);

      const existingStatus = await readExistingImportedSaleStatus(connection, input.saleSource, externalSaleId, false);
      if (existingStatus === 'imported') {
        resultRows.push({
          rowNumber: normalizedRow.rowNumber,
          externalSaleId,
          status: 'skipped',
          article: normalizedRow.article,
          productName: normalizedRow.productName,
          quantity,
          soldAt: normalizedRow.soldAt,
          message: 'Цей рядок продажу вже був імпортований раніше.',
          allocations: []
        });
        continue;
      }

      const product = await findProductForSaleRow(connection, normalizedRow);
      if (!product) {
        resultRows.push(failedSaleRowResult({ externalSaleId, row: normalizedRow }, 'Товар не знайдено за артикулом у довіднику inventory.'));
        continue;
      }

      const store = await findStoreForSaleRow(connection, normalizedRow);
      if (!store) {
        resultRows.push(failedSaleRowResult({ externalSaleId, row: normalizedRow }, 'Магазин зі звіту не знайдено в довіднику stores.'));
        continue;
      }

      const batchKey = `${product.id}:${store.id}`;
      let simulatedBatches = simulatedBatchesByProductStore.get(batchKey);
      if (!simulatedBatches) {
        simulatedBatches = await listFefoBatchesForProductStore(connection, product.id, store.id, false);
        simulatedBatchesByProductStore.set(batchKey, simulatedBatches);
      }

      try {
        const allocationResult = previewInventoryFefoSaleFromRows(simulatedBatches, {
          productId: product.id,
          storeId: store.id,
          quantity
        });

        resultRows.push({
          rowNumber: normalizedRow.rowNumber,
          externalSaleId,
          status: 'imported',
          article: normalizedRow.article,
          productName: normalizedRow.productName,
          quantity,
          soldAt: normalizedRow.soldAt,
          message: 'Dry-run: продаж готовий до FEFO-списання.',
          allocations: allocationResult.allocations
        });
      } catch (error) {
        resultRows.push({
          rowNumber: normalizedRow.rowNumber,
          externalSaleId,
          status: 'failed',
          article: normalizedRow.article,
          productName: normalizedRow.productName,
          quantity,
          soldAt: normalizedRow.soldAt,
          message: error instanceof Error ? error.message : 'Не вдалося перевірити FEFO-списання.',
          allocations: []
        });
      }
    }
  } finally {
    connection.release();
  }

  const importedRows = resultRows.filter((row) => row.status === 'imported').length;
  const skippedRows = resultRows.filter((row) => row.status === 'skipped').length;
  const failedRows = resultRows.filter((row) => row.status === 'failed').length;
  const importedQuantity = resultRows
    .filter((row) => row.status === 'imported')
    .reduce((sum, row) => sum + row.quantity, 0);

  return {
    fileName: input.fileName,
    saleSource: input.saleSource,
    dryRun: true,
    totalRows: input.rows.length,
    importedRows,
    skippedRows,
    failedRows,
    importedQuantity: Math.round(importedQuantity * 1000) / 1000,
    rows: resultRows
  };
}

async function importInventorySalesRowInDb(input: {
  fileName: string;
  saleSource: string;
  externalSaleId: string;
  row: InventorySaleImportRow;
}): Promise<InventorySaleImportRowResult> {
  const pool = getDbPool();
  const connection = await pool.getConnection();
  let resolvedProductId: number | null = null;
  let resolvedStoreId: number | null = null;

  try {
    await connection.beginTransaction();

    const existingStatus = await readExistingImportedSaleStatus(connection, input.saleSource, input.externalSaleId, true);
    if (existingStatus === 'imported') {
      await connection.rollback();
      return {
        rowNumber: input.row.rowNumber,
        externalSaleId: input.externalSaleId,
        status: 'skipped',
        article: input.row.article,
        productName: input.row.productName,
        quantity: input.row.quantity,
        soldAt: input.row.soldAt,
        message: 'Цей рядок продажу вже був імпортований раніше.',
        allocations: []
      };
    }

    const product = await findProductForSaleRow(connection, input.row);
    if (!product) {
      await upsertSaleImportRow(connection, {
        ...input,
        status: 'failed',
        message: 'Товар не знайдено за артикулом у довіднику inventory.',
        productId: null,
        storeId: null,
        allocations: []
      });
      await connection.commit();
      return failedSaleRowResult(input, 'Товар не знайдено за артикулом у довіднику inventory.');
    }
    resolvedProductId = product.id;

    const store = await findStoreForSaleRow(connection, input.row);
    if (!store) {
      await upsertSaleImportRow(connection, {
        ...input,
        status: 'failed',
        message: 'Магазин зі звіту не знайдено в довіднику stores.',
        productId: product.id,
        storeId: null,
        allocations: []
      });
      await connection.commit();
      return failedSaleRowResult(input, 'Магазин зі звіту не знайдено в довіднику stores.');
    }
    resolvedStoreId = store.id;

    const allocationResult = await applyInventoryFefoSaleWithConnection(connection, {
      productId: product.id,
      storeId: store.id,
      quantity: input.row.quantity,
      saleSource: input.saleSource,
      externalSaleId: input.externalSaleId,
      soldAt: input.row.soldAt
    });

    await upsertSaleImportRow(connection, {
      ...input,
      status: 'imported',
      message: 'Продаж списано по FEFO.',
      productId: product.id,
      storeId: store.id,
      allocations: allocationResult.allocations
    });

    await connection.commit();
    return {
      rowNumber: input.row.rowNumber,
      externalSaleId: input.externalSaleId,
      status: 'imported',
      article: input.row.article,
      productName: input.row.productName,
      quantity: input.row.quantity,
      soldAt: input.row.soldAt,
      message: 'Продаж списано по FEFO.',
      allocations: allocationResult.allocations
    };
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : 'Не вдалося списати продаж по FEFO.';
    try {
      await upsertSaleImportRow(connection, {
        ...input,
        status: 'failed',
        message,
        productId: resolvedProductId,
        storeId: resolvedStoreId,
        allocations: []
      });
    } catch {
      // Keep the original row-level import error visible even if failure logging is unavailable.
    }
    return {
      rowNumber: input.row.rowNumber,
      externalSaleId: input.externalSaleId,
      status: 'failed',
      article: input.row.article,
      productName: input.row.productName,
      quantity: input.row.quantity,
      soldAt: input.row.soldAt,
      message,
      allocations: []
    };
  } finally {
    connection.release();
  }
}

async function applyInventoryFefoSaleWithConnection(
  connection: PoolConnection,
  input: {
    productId: number;
    storeId: number;
    quantity: number;
    saleSource: string;
    externalSaleId: string | null;
    soldAt: string | null;
  }
) {
  const quantity = normalizeQuantity(input.quantity);
  if (quantity <= 0) {
    throw new Error('Кількість для FEFO-списання має бути більшою за 0.');
  }

  const batchRows = await listFefoBatchesForProductStore(connection, input.productId, input.storeId, true);

  const availableQuantity = batchRows.reduce((sum, row) => sum + Number(row.quantity_current ?? 0), 0);
  if (availableQuantity < quantity) {
    throw new Error(`Недостатньо залишку для FEFO-списання. Доступно ${availableQuantity}, потрібно ${quantity}.`);
  }

  let remaining = quantity;
  const allocations: InventoryFefoSaleAllocation[] = [];

  for (const batch of batchRows) {
    if (remaining <= 0) break;

    const currentQuantity = Number(batch.quantity_current ?? 0);
    if (currentQuantity <= 0) continue;

    const soldQuantity = Math.min(currentQuantity, remaining);
    const nextQuantity = Math.round((currentQuantity - soldQuantity) * 1000) / 1000;

    await connection.query(
      `
        UPDATE product_batches
        SET
          quantity_current = ?,
          quantity = ?,
          batch_status = CASE WHEN ? <= 0 THEN 'closed' ELSE batch_status END,
          updated_at = NOW()
        WHERE id = ?
      `,
      [nextQuantity, nextQuantity, nextQuantity, batch.id]
    );

    await insertBatchSaleRow(connection, {
      batchId: batch.id,
      productId: input.productId,
      storeId: input.storeId,
      soldQuantity,
      saleSource: input.saleSource,
      externalSaleId: input.externalSaleId,
      soldAt: input.soldAt
    });

    allocations.push({
      batchId: batch.id,
      soldQuantity,
      expiryDate: batch.expiry_date
    });
    remaining = Math.round((remaining - soldQuantity) * 1000) / 1000;
  }

  if (remaining > 0) {
    throw new Error(`FEFO-списання не завершено. Не вистачило ${remaining} од.`);
  }

  return {
    productId: input.productId,
    storeId: input.storeId,
    requestedQuantity: quantity,
    allocations
  };
}

async function listFefoBatchesForProductStore(
  connection: PoolConnection,
  productId: number,
  storeId: number,
  lockRows: boolean
): Promise<FefoBatchRow[]> {
  const [batchRows] = await connection.query<FefoBatchRow[]>(
    `
      SELECT
        id,
        product_id,
        store_id,
        quantity_current,
        batch_status,
        DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiry_date
      FROM product_batches
      WHERE
        product_id = ?
        AND store_id = ?
        AND quantity_current > 0
        AND COALESCE(batch_status, 'active') IN ('active', 'hold')
      ORDER BY expiry_date ASC, created_at ASC, id ASC
      ${lockRows ? 'FOR UPDATE' : ''}
    `,
    [productId, storeId]
  );

  return batchRows.map((row) => ({
    ...row,
    quantity_current: Number(row.quantity_current ?? 0)
  }));
}

function previewInventoryFefoSaleFromRows(
  batchRows: FefoBatchRow[],
  input: {
    productId: number;
    storeId: number;
    quantity: number;
  }
) {
  const quantity = normalizeQuantity(input.quantity);
  if (quantity <= 0) {
    throw new Error('Кількість для FEFO-списання має бути більшою за 0.');
  }

  const availableQuantity = batchRows.reduce((sum, row) => sum + Number(row.quantity_current ?? 0), 0);
  if (availableQuantity < quantity) {
    throw new Error(`Недостатньо залишку для FEFO-списання. Доступно ${availableQuantity}, потрібно ${quantity}.`);
  }

  let remaining = quantity;
  const allocations: InventoryFefoSaleAllocation[] = [];

  for (const batch of batchRows) {
    if (remaining <= 0) break;

    const currentQuantity = Number(batch.quantity_current ?? 0);
    if (currentQuantity <= 0) continue;

    const soldQuantity = Math.min(currentQuantity, remaining);
    batch.quantity_current = Math.round((currentQuantity - soldQuantity) * 1000) / 1000;
    allocations.push({
      batchId: batch.id,
      soldQuantity,
      expiryDate: batch.expiry_date
    });
    remaining = Math.round((remaining - soldQuantity) * 1000) / 1000;
  }

  if (remaining > 0) {
    throw new Error(`FEFO-списання не завершено. Не вистачило ${remaining} од.`);
  }

  return {
    productId: input.productId,
    storeId: input.storeId,
    requestedQuantity: quantity,
    allocations
  };
}

function failedSaleRowResult(
  input: { externalSaleId: string; row: InventorySaleImportRow },
  message: string
): InventorySaleImportRowResult {
  return {
    rowNumber: input.row.rowNumber,
    externalSaleId: input.externalSaleId,
    status: 'failed',
    article: input.row.article,
    productName: input.row.productName,
    quantity: input.row.quantity,
    soldAt: input.row.soldAt,
    message,
    allocations: []
  };
}

async function readExistingImportedSaleStatus(
  connection: PoolConnection,
  saleSource: string,
  externalSaleId: string,
  lockRow: boolean
): Promise<string | null> {
  const [rows] = await connection.query<Array<RowDataPacket & { status: string }>>(
    `
      SELECT status
      FROM inventory_sale_import_rows
      WHERE sale_source = ? AND external_sale_id = ?
      LIMIT 1
      ${lockRow ? 'FOR UPDATE' : ''}
    `,
    [saleSource, externalSaleId]
  );
  return rows[0]?.status ?? null;
}

async function findProductForSaleRow(
  connection: PoolConnection,
  row: InventorySaleImportRow
): Promise<ProductLookupRow | null> {
  const [rows] = await connection.query<ProductLookupRow[]>(
    `
      SELECT id, article, product_name
      FROM products
      WHERE article = ?
      ORDER BY
        CASE WHEN product_name = ? THEN 0 ELSE 1 END,
        is_active DESC,
        id ASC
      LIMIT 1
    `,
    [row.article, row.productName]
  );
  return rows[0] ?? null;
}

async function findStoreForSaleRow(
  connection: PoolConnection,
  row: InventorySaleImportRow
): Promise<StoreLookupRow | null> {
  const storeCodeMatch = row.storeLabel.match(/Магазин\s*([0-9]+)/i);
  const storeCode = storeCodeMatch?.[1] ?? '';
  const [rows] = await connection.query<StoreLookupRow[]>(
    `
      SELECT id, store_code, name, city, address_line
      FROM stores
      WHERE
        (? <> '' AND (store_code = ? OR store_code = CONCAT('M', ?) OR store_code = CONCAT('М', ?)))
        OR name = ?
        OR ? LIKE CONCAT('%', city, '%', address_line, '%')
      ORDER BY is_active DESC, id ASC
      LIMIT 1
    `,
    [storeCode, storeCode, storeCode, storeCode, row.storeLabel, row.storeLabel]
  );
  return rows[0] ?? null;
}

async function upsertSaleImportRow(
  connection: PoolConnection,
  input: {
    fileName: string;
    saleSource: string;
    externalSaleId: string;
    row: InventorySaleImportRow;
    status: 'imported' | 'failed';
    message: string;
    productId: number | null;
    storeId: number | null;
    allocations: InventoryFefoSaleAllocation[];
  }
) {
  await connection.query(
    `
      INSERT INTO inventory_sale_import_rows (
        sale_source,
        external_sale_id,
        file_name,
        row_number,
        store_label,
        cash_register,
        receipt_number,
        article,
        product_name,
        price_scheme,
        price,
        discounted_price,
        quantity,
        line_total,
        receipt_total,
        sold_at,
        product_id,
        store_id,
        status,
        error_message,
        allocations_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        file_name = VALUES(file_name),
        row_number = VALUES(row_number),
        store_label = VALUES(store_label),
        cash_register = VALUES(cash_register),
        receipt_number = VALUES(receipt_number),
        article = VALUES(article),
        product_name = VALUES(product_name),
        price_scheme = VALUES(price_scheme),
        price = VALUES(price),
        discounted_price = VALUES(discounted_price),
        quantity = VALUES(quantity),
        line_total = VALUES(line_total),
        receipt_total = VALUES(receipt_total),
        sold_at = VALUES(sold_at),
        product_id = VALUES(product_id),
        store_id = VALUES(store_id),
        status = VALUES(status),
        error_message = VALUES(error_message),
        allocations_json = VALUES(allocations_json),
        updated_at = NOW()
    `,
    [
      input.saleSource,
      input.externalSaleId,
      input.fileName,
      input.row.rowNumber,
      input.row.storeLabel,
      input.row.cashRegister,
      input.row.receiptNumber,
      input.row.article,
      input.row.productName,
      input.row.priceScheme,
      input.row.price,
      input.row.discountedPrice,
      input.row.quantity,
      input.row.lineTotal,
      input.row.receiptTotal,
      input.row.soldAt,
      input.productId,
      input.storeId,
      input.status,
      input.status === 'failed' ? input.message : null,
      JSON.stringify(input.allocations)
    ]
  );
}

async function insertBatchSaleRow(
  connection: PoolConnection,
  input: {
    batchId: number;
    productId: number;
    storeId: number;
    soldQuantity: number;
    saleSource: string;
    externalSaleId: string | null;
    soldAt: string | null;
  }
) {
  const [result] = await connection.query<ResultSetHeader>(
    `
      INSERT INTO batch_sales (
        batch_id,
        product_id,
        store_id,
        sold_quantity,
        sale_source,
        external_sale_id,
        sold_at
      ) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))
    `,
    [
      input.batchId,
      input.productId,
      input.storeId,
      input.soldQuantity,
      input.saleSource,
      input.externalSaleId,
      input.soldAt
    ]
  );

  return result.insertId;
}
