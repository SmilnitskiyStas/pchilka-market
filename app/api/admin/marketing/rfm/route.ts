import { NextRequest, NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getRfmReport } from '@/lib/marketing-rfm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const days = Number(request.nextUrl.searchParams.get('days') ?? 180);
    const report = await getRfmReport(days);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error('[marketing-rfm]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Не вдалося отримати RFM-дані.' },
      { status: 500 }
    );
  }
}
