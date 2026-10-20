import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { emptyProductInfoDetails, PRODUCT_INFO_DB_COLUMNS, PRODUCT_INFO_FIELD_KEYS, type ProductInfoDetails } from '@/lib/public-product-info-fields';

type ProductRow = RowDataPacket & { id: number; article: string; name: string; barcode: string | null };

function normalize(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, '').replace(/\.0+$/, '');
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

export async function findProductByCode(codeInput: string) {
  const code = normalize(codeInput);
  if (!code || code.length > 120) return null;

  const [rows] = await getDbPool().query<ProductRow[]>(
    `SELECT p.id, p.article, p.product_name AS name, pb.barcode FROM products p LEFT JOIN product_barcodes pb ON pb.product_id=p.id AND REPLACE(TRIM(COALESCE(pb.barcode,'')), ' ', '')=? WHERE p.is_active=1 AND (pb.id IS NOT NULL OR REPLACE(TRIM(COALESCE(p.article,'')), ' ', '')=?) ORDER BY p.id LIMIT 1`,
    [code, code]
  );
  return rows[0] ?? null;
}

export async function saveProductDetails(productId: number, input: Partial<ProductInfoDetails>) {
  const details = { ...emptyProductInfoDetails(), ...input };
  const values = PRODUCT_INFO_FIELD_KEYS.map((key) => text(details[key]));
  const columns = ['product_id', ...PRODUCT_INFO_DB_COLUMNS, 'is_gmo_free'];
  const updates = PRODUCT_INFO_DB_COLUMNS.map((column) => `${column}=VALUES(${column})`).concat('is_gmo_free=VALUES(is_gmo_free)').join(', ');
  await getDbPool().query(
    `INSERT INTO public_product_info (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${updates}`,
    [productId, ...values, details.isGmoFree ? 1 : 0]
  );
}
