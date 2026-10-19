import { NextResponse } from 'next/server';

import { getAdminSessionFromRequest, isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getDbPool } from '@/lib/db';
import {
  findInventoryProductBarcodeOwnersInDb,
  mergeInventoryProductsInDb,
  updateInventoryProductInDb
} from '@/lib/inventory-products-repository';
import { normalizeInventoryProductInput } from '@/lib/inventory-product-types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const body = (await request.json()) as {
      sourceProductId?: unknown;
      sourceProductIds?: unknown;
      targetProductId?: unknown;
      product?: Record<string, unknown>;
      approvalAction?: 'approve' | 'update';
      note?: string;
    };
    const sourceProductId = Number(body.sourceProductId);
    const targetProductId = Number(body.targetProductId);
    const product = normalizeInventoryProductInput(body.product);
    const sourceProductIds = Array.from(
      new Set(
        [sourceProductId, ...(Array.isArray(body.sourceProductIds) ? body.sourceProductIds.map((value) => Number(value)) : [])]
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    );
    if (!Number.isFinite(sourceProductId) || sourceProductIds.length === 0 || !Number.isFinite(targetProductId) || targetProductId <= 0 || sourceProductIds.includes(targetProductId)) {
      return NextResponse.json({ ok: false, error: 'Оберіть два різні товари для об’єднання.' }, { status: 400 });
    }
    if (!product.article || !product.productName || !product.unitsOfMeasurement) {
      return NextResponse.json({ ok: false, error: 'Вкажіть артикул, назву товару та одиницю виміру.' }, { status: 400 });
    }

    const connection = await getDbPool().getConnection();
    try {
      const knownProductIds = new Set([...sourceProductIds, targetProductId]);
      const conflictProducts = new Map<number, Awaited<ReturnType<typeof findInventoryProductBarcodeOwnersInDb>>[number]>();
      for (const barcode of product.barcodes) {
        for (const candidate of await findInventoryProductBarcodeOwnersInDb(barcode, connection)) {
          if (!knownProductIds.has(Number(candidate.id))) {
            conflictProducts.set(Number(candidate.id), candidate);
          }
        }
      }
      if (conflictProducts.size > 0) {
        const conflicts = Array.from(conflictProducts.values());
        return NextResponse.json(
          {
            ok: false,
            error: 'Частина штрихкодів уже належить іншим карткам товарів. Додайте всі знайдені картки до об’єднання або виправте штрихкоди.',
            conflictProduct: conflicts[0],
            conflictProducts: conflicts
          },
          { status: 409 }
        );
      }

      await connection.beginTransaction();
      for (const sourceId of sourceProductIds) {
        await mergeInventoryProductsInDb(
          {
            sourceProductId: sourceId,
            targetProductId,
            changeSource: 'admin_product_merge',
            changedBy: getAdminSessionFromRequest(request)?.username ?? 'admin',
            changeNote: String(body.note ?? '').trim() || `Об’єднано дублікати товарів #${sourceId} та #${targetProductId}.`
          },
          connection
        );
      }
      const updatedProduct = await updateInventoryProductInDb(targetProductId, product, connection, {
        changeSource: 'admin_product_merge',
        changedBy: getAdminSessionFromRequest(request)?.username ?? 'admin',
        approvalStatus: body.approvalAction === 'approve' ? 'approved' : undefined,
        approvalNote: String(body.note ?? '').trim(),
        approvedAt: body.approvalAction === 'approve' ? new Date() : null,
        approvedByUserId: null
      });
      await connection.commit();
      return NextResponse.json({ ok: true, product: updatedProduct, mergedProductIds: sourceProductIds });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося об’єднати товари.';
    const status = message.includes('Товар не знайдено') ? 404 : message.includes('Товар уже існує') || message.includes('Штрихкод') ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
