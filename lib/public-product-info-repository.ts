import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

type PublicProductLookupRow = RowDataPacket & {
  article: string;
  name: string;
  barcode: string | null;
};

export type PublicProductLookupResult = {
  article: string;
  name: string;
  barcode: string | null;
};

function normalizeLookupCode(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/\.0+$/, '');
}

export async function findPublicProductByCode(rawCode: string): Promise<PublicProductLookupResult | null> {
  const code = normalizeLookupCode(rawCode);
  if (!code || code.length > 120) return null;

  const db = getDbPool();
  const [rows] = await db.query<PublicProductLookupRow[]>(
    `
      SELECT
        p.article,
        p.product_name AS name,
        matched_barcode.barcode
      FROM products p
      LEFT JOIN product_barcodes AS matched_barcode
        ON matched_barcode.product_id = p.id
        AND REPLACE(TRIM(COALESCE(matched_barcode.barcode, '')), ' ', '') = ?
      WHERE p.is_active = 1
        AND (
          matched_barcode.id IS NOT NULL
          OR REPLACE(TRIM(COALESCE(p.article, '')), ' ', '') = ?
        )
      ORDER BY p.id ASC
      LIMIT 1
    `,
    [code, code]
  );

  return rows[0] ?? null;
}

