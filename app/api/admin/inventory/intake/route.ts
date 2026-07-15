import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getDbPool } from '@/lib/db';
import {
  createInventoryBatchInDb,
  findInventoryDuplicateBatchInDb,
  mergeInventoryBatchQuantityInDb
} from '@/lib/inventory-batches-repository';
import { getSuspiciousInventoryExpiryDate } from '@/lib/inventory-expiry-date-rules';
import { createInventoryProductInDb, findInventoryProductDuplicateInDb } from '@/lib/inventory-products-repository';
import { normalizeInventoryBatchInput } from '@/lib/inventory-batch-types';
import { normalizeInventoryProductInput } from '@/lib/inventory-product-types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as {
      product?: Record<string, unknown>;
      batch?: Record<string, unknown>;
      duplicateAction?: 'merge';
      confirmSuspiciousExpiryDate?: boolean;
    };

    const productInput = normalizeInventoryProductInput(body?.product);
    if (!productInput.article) {
      return NextResponse.json({ ok: false, error: 'Артикул є обов’язковим.' }, { status: 400 });
    }
    if (!productInput.productName) {
      return NextResponse.json({ ok: false, error: 'Назва товару є обов’язковою.' }, { status: 400 });
    }
    if (!productInput.unitsOfMeasurement) {
      return NextResponse.json({ ok: false, error: 'Одиниця виміру є обов’язковою.' }, { status: 400 });
    }

    const batchInput = normalizeInventoryBatchInput(body?.batch);

    const suspiciousExpiryDate = getSuspiciousInventoryExpiryDate({
      expiryDate: batchInput.expiryDate,
      deliveryDate: batchInput.deliveryDate
    });
    if (suspiciousExpiryDate.isSuspicious && body?.confirmSuspiciousExpiryDate !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: suspiciousExpiryDate.message,
          suspiciousExpiryDate
        },
        { status: 428 }
      );
    }

    const duplicateProduct = await findInventoryProductDuplicateInDb({
      article: productInput.article,
      barcode: productInput.barcode,
      productName: productInput.productName,
      unitsOfMeasurement: productInput.unitsOfMeasurement
    });
    const pool = getDbPool();
    const connection = await pool.getConnection();
    let duplicateConflict: Awaited<ReturnType<typeof findInventoryDuplicateBatchInDb>> = null;
    let duplicateLockName = '';
    let batchCodeLockName = '';
    let result:
      | {
          product: Awaited<ReturnType<typeof createInventoryProductInDb>>;
          batch: Awaited<ReturnType<typeof createInventoryBatchInDb>>;
          resolution: 'created' | 'merged';
          usedExistingProduct: boolean;
        }
      | null = null;
    try {
      await connection.beginTransaction();

      const product = duplicateProduct ?? (await createInventoryProductInDb(productInput, connection));
      const normalizedBatchInput = normalizeInventoryBatchInput({ ...batchInput, productId: product.id });
      duplicateLockName = `inv_batch:${normalizedBatchInput.storeId}:${normalizedBatchInput.productId}:${normalizedBatchInput.expiryDate}`;
      const [lockRows] = await connection.query<Array<RowDataPacket & { lock_acquired: number | null }>>(
        'SELECT GET_LOCK(?, 10) AS lock_acquired',
        [duplicateLockName]
      );
      if (Number(lockRows[0]?.lock_acquired ?? 0) !== 1) {
        throw new Error('Не вдалося заблокувати одночасне створення партії. Спробуйте ще раз.');
      }
      batchCodeLockName = `inventory_batch_code:${normalizedBatchInput.storeId}`;
      const [batchCodeLockRows] = await connection.query<Array<RowDataPacket & { lock_acquired: number | null }>>(
        'SELECT GET_LOCK(?, 10) AS lock_acquired',
        [batchCodeLockName]
      );
      if (Number(batchCodeLockRows[0]?.lock_acquired ?? 0) !== 1) {
        throw new Error('Не вдалося заблокувати одночасну генерацію коду партії. Спробуйте ще раз.');
      }

      const duplicateBatch = await findInventoryDuplicateBatchInDb(
        {
          storeId: normalizedBatchInput.storeId,
          productId: normalizedBatchInput.productId,
          expiryDate: normalizedBatchInput.expiryDate
        },
        connection
      );

      if (duplicateBatch && body?.duplicateAction !== 'merge') {
        duplicateConflict = duplicateBatch;
        await connection.rollback();
      } else if (duplicateBatch) {
        const batch = await mergeInventoryBatchQuantityInDb(
          {
            batchId: duplicateBatch.id,
            quantity: normalizedBatchInput.quantity,
            batchCode: normalizedBatchInput.batchCode,
            deliveryDate: normalizedBatchInput.deliveryDate,
            notifiedDays: normalizedBatchInput.notifiedDays
          },
          connection
        );
        result = { product, batch, resolution: 'merged', usedExistingProduct: true };
        await connection.commit();
      } else {
        const batch = await createInventoryBatchInDb(normalizedBatchInput, connection);
        result = {
          product,
          batch,
          resolution: 'created',
          usedExistingProduct: Boolean(duplicateProduct)
        };
        await connection.commit();
      }
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      if (batchCodeLockName) {
        await connection.query('SELECT RELEASE_LOCK(?)', [batchCodeLockName]).catch(() => undefined);
      }
      if (duplicateLockName) {
        await connection.query('SELECT RELEASE_LOCK(?)', [duplicateLockName]).catch(() => undefined);
      }
      connection.release();
    }

    if (duplicateConflict) {
      return NextResponse.json(
        {
          ok: false,
          error: 'У цьому магазині вже є така партія з цим самим терміном придатності.',
          duplicateBatch: duplicateConflict
        },
        { status: 409 }
      );
    }

    if (!result) {
      throw new Error('Не вдалося створити товар і партію.');
    }

    return NextResponse.json({
      ok: true,
      product: result.product,
      batch: result.batch,
      resolution: result.resolution,
      usedExistingProduct: result.usedExistingProduct
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося створити товар і партію.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
