import { NextRequest, NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getRfmMigrationReport } from '@/lib/marketing-rfm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const storeId = Number(request.nextUrl.searchParams.get('storeId'));
    const migration = await getRfmMigrationReport(Number(request.nextUrl.searchParams.get('days') ?? 180), storeId);
    return NextResponse.json({ ok: true, migration });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити міграцію.' }, { status: 500 });
  }
}
