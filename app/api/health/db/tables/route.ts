import { NextResponse } from 'next/server';

import { getDbPool } from '../../../../../lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query('SHOW TABLES');
    return NextResponse.json({ ok: true, tables: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
