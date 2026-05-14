import { NextResponse } from 'next/server';

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
      duplicateAction?: 'merge' | 'create_anyway';
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
    const duplicateBatch =
      duplicateProduct && batchInput.storeId && batchInput.expiryDate
        ? await findInventoryDuplicateBatchInDb({
            storeId: batchInput.storeId,
            productId: duplicateProduct.id,
            expiryDate: batchInput.expiryDate
          })
        : null;

    if (duplicateBatch && body?.duplicateAction !== 'merge' && body?.duplicateAction !== 'create_anyway') {
      return NextResponse.json(
        {
          ok: false,
          error: 'У цьому магазині вже є така партія з цим самим терміном придатності.',
          duplicateBatch
        },
        { status: 409 }
      );
    }

    const pool = getDbPool();
    const connection = await pool.getConnection();
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

      if (duplicateBatch && body?.duplicateAction === 'merge') {
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
      } else {
        const batch = await createInventoryBatchInDb(normalizedBatchInput, connection);
        result = {
          product,
          batch,
          resolution: 'created',
          usedExistingProduct: Boolean(duplicateProduct)
        };
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
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
