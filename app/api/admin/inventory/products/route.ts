import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  countInventoryProductsInDb,
  createInventoryProductInDb,
  findInventoryProductDuplicateInDb,
  listInventoryProductCategoriesFromDb,
  listInventoryProductsFromDb
} from '@/lib/inventory-products-repository';
import { normalizeInventoryProductInput } from '@/lib/inventory-product-types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const category = url.searchParams.get('category') ?? '';
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const page = Number(url.searchParams.get('page') ?? 1);
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const safePage = Math.max(page, 1);
    const offset = (safePage - 1) * safeLimit;
    const [products, totalCount, categories] = await Promise.all([
      listInventoryProductsFromDb(q, safeLimit, offset, category),
      countInventoryProductsInDb(q, category),
      listInventoryProductCategoriesFromDb()
    ]);
    return NextResponse.json({ ok: true, products, totalCount, categories, page: safePage, limit: safeLimit });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as { product?: unknown };
    const normalized = normalizeInventoryProductInput((body?.product ?? {}) as Record<string, unknown>);

    if (!normalized.article) {
      return NextResponse.json({ ok: false, error: 'Артикул є обов’язковим.' }, { status: 400 });
    }
    if (!normalized.productName) {
      return NextResponse.json({ ok: false, error: 'Назва товару є обов’язковою.' }, { status: 400 });
    }
    if (!normalized.unitsOfMeasurement) {
      return NextResponse.json({ ok: false, error: 'Одиниця виміру є обов’язковою.' }, { status: 400 });
    }

    const duplicate = await findInventoryProductDuplicateInDb({
      article: normalized.article,
      barcode: normalized.barcode,
      productName: normalized.productName,
      unitsOfMeasurement: normalized.unitsOfMeasurement
    });
    if (duplicate) {
      return NextResponse.json(
        { ok: false, error: `РўРѕРІР°СЂ СѓР¶Рµ С–СЃРЅСѓС” РІ Р±Р°Р·С–: ${duplicate.productName}.` },
        { status: 409 }
      );
    }

    const product = await createInventoryProductInDb(normalized);
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
