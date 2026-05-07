import { NextResponse } from 'next/server';

import { pingDb } from '../../../../lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const ok = await pingDb();
    return NextResponse.json({ ok });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
