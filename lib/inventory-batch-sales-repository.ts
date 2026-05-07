import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

type FefoBatchRow = RowDataPacket & {
  id: number;
  product_id: number;
  store_id: number;
  quantity_current: number;
  batch_status: string | null;
  expiry_date: string;
};

export type InventoryFefoSaleAllocation = {
  batchId: number;
  soldQuantity: number;
  expiryDate: string;
};

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
  const quantity = Math.max(Math.round(Number(input.quantity ?? 0)), 0);
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
        FOR UPDATE
      `,
      [productId, storeId]
    );

    const availableQuantity = batchRows.reduce((sum, row) => sum + Number(row.quantity_current ?? 0), 0);
    if (availableQuantity < quantity) {
      throw new Error(
        `Недостатньо залишку для FEFO-списання. Доступно ${availableQuantity}, потрібно ${quantity}.`
      );
    }

    let remaining = quantity;
    const allocations: InventoryFefoSaleAllocation[] = [];

    for (const batch of batchRows) {
      if (remaining <= 0) break;

      const currentQuantity = Number(batch.quantity_current ?? 0);
      if (currentQuantity <= 0) continue;

      const soldQuantity = Math.min(currentQuantity, remaining);
      const nextQuantity = currentQuantity - soldQuantity;

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

      await insertBatchSaleRow(
        connection,
        {
          batchId: batch.id,
          productId,
          storeId,
          soldQuantity,
          saleSource,
          externalSaleId,
          soldAt
        }
      );

      allocations.push({
        batchId: batch.id,
        soldQuantity,
        expiryDate: batch.expiry_date
      });
      remaining -= soldQuantity;
    }

    if (remaining > 0) {
      throw new Error(`FEFO-списання не завершено. Не вистачило ${remaining} од.`);
    }

    await connection.commit();
    return {
      productId,
      storeId,
      requestedQuantity: quantity,
      allocations
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
