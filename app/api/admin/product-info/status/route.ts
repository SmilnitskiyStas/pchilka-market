import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getDbPool } from '@/lib/db';

type Status = 'complete' | 'missing';
type ProductStatusRow = RowDataPacket & { article: string; name: string; barcode: string | null; hasInfo: number };

function pageNumber(value: string | null) { return Math.max(1, Math.min(100000, Number.parseInt(value ?? '1', 10) || 1)); }

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const params = new URL(request.url).searchParams;
    const status: Status = params.get('status') === 'complete' ? 'complete' : 'missing';
    const search = (params.get('search') ?? '').trim().slice(0, 120);
    const page = pageNumber(params.get('page')); const limit = 50; const offset = (page - 1) * limit;
    const hasInfo = status === 'complete' ? 'info.product_id IS NOT NULL' : 'info.product_id IS NULL';
    const filters = [`p.is_active=1`, hasInfo]; const values: Array<string | number> = [];
    if (search) { filters.push(`(p.product_name LIKE ? OR p.article LIKE ? OR EXISTS (SELECT 1 FROM product_barcodes search_barcode WHERE search_barcode.product_id=p.id AND search_barcode.barcode LIKE ?))`); values.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    const where = filters.join(' AND '); const db = getDbPool();
    const [summaryRows] = await db.query<Array<RowDataPacket & { completeCount: number; missingCount: number }>>(`SELECT SUM(info.product_id IS NOT NULL) AS completeCount, SUM(info.product_id IS NULL) AS missingCount FROM products p LEFT JOIN public_product_info info ON info.product_id=p.id WHERE p.is_active=1`);
    const [countRows] = await db.query<Array<RowDataPacket & { total: number }>>(`SELECT COUNT(*) AS total FROM products p LEFT JOIN public_product_info info ON info.product_id=p.id WHERE ${where}`, values);
    const [products] = await db.query<ProductStatusRow[]>(`SELECT p.article, p.product_name AS name, (SELECT barcode FROM product_barcodes pb WHERE pb.product_id=p.id ORDER BY pb.id LIMIT 1) AS barcode, (info.product_id IS NOT NULL) AS hasInfo FROM products p LEFT JOIN public_product_info info ON info.product_id=p.id WHERE ${where} ORDER BY p.product_name ASC, p.id ASC LIMIT ? OFFSET ?`, [...values, limit, offset]);
    return NextResponse.json({ ok: true, products, page, total: countRows[0]?.total ?? 0, summary: { complete: Number(summaryRows[0]?.completeCount ?? 0), missing: Number(summaryRows[0]?.missingCount ?? 0) } });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити реєстр товарів.' }, { status: 500 }); }
}
