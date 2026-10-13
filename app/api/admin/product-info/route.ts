import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getDbPool } from '@/lib/db';
import { emptyProductInfoDetails, PRODUCT_INFO_DB_COLUMNS, PRODUCT_INFO_FIELD_KEYS, type ProductInfoDetails } from '@/lib/public-product-info-fields';

type ProductRow = RowDataPacket & { id: number; article: string; name: string; barcode: string | null };
type DetailsRow = RowDataPacket & Partial<ProductInfoDetails>;

function normalize(value: unknown) { return String(value ?? '').trim().replace(/\s+/g, '').replace(/\.0+$/, ''); }
function text(value: unknown) { return String(value ?? '').trim(); }

export async function findProductByCode(codeInput: string) {
  const code = normalize(codeInput);
  if (!code || code.length > 120) return null;
  const [rows] = await getDbPool().query<ProductRow[]>(
    `SELECT p.id, p.article, p.product_name AS name, pb.barcode FROM products p LEFT JOIN product_barcodes pb ON pb.product_id=p.id AND REPLACE(TRIM(COALESCE(pb.barcode,'')), ' ', '')=? WHERE p.is_active=1 AND (pb.id IS NOT NULL OR REPLACE(TRIM(COALESCE(p.article,'')), ' ', '')=?) ORDER BY p.id LIMIT 1`, [code, code]
  );
  return rows[0] ?? null;
}

function selectDetails() { return PRODUCT_INFO_FIELD_KEYS.map((key, index) => `${PRODUCT_INFO_DB_COLUMNS[index]} AS ${key}`).join(', '); }
export async function saveProductDetails(productId: number, input: Partial<ProductInfoDetails>) {
  const details = { ...emptyProductInfoDetails(), ...input };
  const values = PRODUCT_INFO_FIELD_KEYS.map((key) => text(details[key]));
  const columns = ['product_id', ...PRODUCT_INFO_DB_COLUMNS, 'is_gmo_free'];
  const updates = PRODUCT_INFO_DB_COLUMNS.map((column) => `${column}=VALUES(${column})`).concat('is_gmo_free=VALUES(is_gmo_free)').join(', ');
  await getDbPool().query(`INSERT INTO public_product_info (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${updates}`, [productId, ...values, details.isGmoFree ? 1 : 0]);
}

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
