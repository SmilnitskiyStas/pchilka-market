import { NextRequest, NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getRfmSegmentDetailForStore } from '@/lib/marketing-rfm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ segmentId: string }> }) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const { segmentId } = await params;
    const days = Number(request.nextUrl.searchParams.get('days') ?? 180);
    const rawStoreId = request.nextUrl.searchParams.get('storeId');
    const storeId = rawStoreId ? Number(rawStoreId) : undefined;
    const detail = await getRfmSegmentDetailForStore(days, segmentId, Number.isInteger(storeId) ? storeId : undefined);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити сегмент.' }, { status: 500 });
  }
}
