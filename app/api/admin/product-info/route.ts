import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { findProductByCode, saveProductDetails } from '@/lib/admin-product-info-repository';
import { getDbPool } from '@/lib/db';
import { emptyProductInfoDetails, PRODUCT_INFO_DB_COLUMNS, PRODUCT_INFO_FIELD_KEYS, type ProductInfoDetails } from '@/lib/public-product-info-fields';

type DetailsRow = RowDataPacket & Partial<ProductInfoDetails>;

function selectDetails() { return PRODUCT_INFO_FIELD_KEYS.map((key, index) => `${PRODUCT_INFO_DB_COLUMNS[index]} AS ${key}`).join(', '); }

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const product = await findProductByCode(new URL(request.url).searchParams.get('code') ?? '');
    if (!product) return NextResponse.json({ ok: false, error: 'Товар не знайдено.' }, { status: 404 });
    const [rows] = await getDbPool().query<DetailsRow[]>(`SELECT ${selectDetails()}, is_gmo_free AS isGmoFree FROM public_product_info WHERE product_id=? LIMIT 1`, [product.id]);
    return NextResponse.json({ ok: true, product, details: { ...emptyProductInfoDetails(), ...(rows[0] ?? {}), isGmoFree: Boolean(rows[0]?.isGmoFree) } });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Помилка завантаження.' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const body = await request.json() as { code?: string; details?: Partial<ProductInfoDetails> };
    const product = await findProductByCode(body.code ?? '');
    if (!product) return NextResponse.json({ ok: false, error: 'Товар не знайдено.' }, { status: 404 });
    await saveProductDetails(product.id, body.details ?? {});
    return NextResponse.json({ ok: true, product });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Помилка збереження.' }, { status: 500 }); }
}
