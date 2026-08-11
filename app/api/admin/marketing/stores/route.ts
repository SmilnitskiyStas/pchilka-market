import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getDbPool } from '@/lib/db';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const pool = getDbPool();
    const [stores] = await pool.query<Array<RowDataPacket & { id: string; name: string }>>(`
      SELECT CAST(tp_code AS CHAR) AS id, store_code AS name
      FROM stores
      WHERE tp_code IS NOT NULL
      ORDER BY tp_code
    `);
    if (stores.length || process.env.NODE_ENV === 'production') return NextResponse.json({ ok: true, stores });
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw error;
  }
  return NextResponse.json({ ok: true, stores: [
    { id: '2', name: 'М2 (тестовий локальний)' },
    { id: '3', name: 'М3 (тестовий локальний)' },
    { id: '5', name: 'М5 (тестовий локальний)' }
  ] });
}
