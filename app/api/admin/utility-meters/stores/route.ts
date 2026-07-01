import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

export const runtime = 'nodejs';

type StoreRow = RowDataPacket & {
  id: number;
  store_code: string | null;
  name: string;
  city: string;
  address_line: string;
  is_active: number;
};

export async function GET() {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<StoreRow[]>(
      `
        SELECT id, store_code, name, city, address_line, is_active
        FROM stores
        ORDER BY sort_order ASC, city ASC, id ASC
      `
    );

    return NextResponse.json({
      ok: true,
      stores: rows.map((row) => ({
        id: String(row.id),
        storeCode: row.store_code ?? '',
        name: row.name,
        city: row.city,
        addressLine: row.address_line,
        isActive: row.is_active === 1
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
