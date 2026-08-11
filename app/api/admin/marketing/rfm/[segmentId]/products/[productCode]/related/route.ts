import { NextRequest, NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getRfmProductRelations } from '@/lib/marketing-rfm';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ segmentId: string; productCode: string }> }) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const { segmentId, productCode } = await params;
    const rawStoreId = request.nextUrl.searchParams.get('storeId');
    const storeId = rawStoreId ? Number(rawStoreId) : undefined;
    const relations = await getRfmProductRelations(Number(request.nextUrl.searchParams.get('days') ?? 180), segmentId, productCode, Number.isInteger(storeId) ? storeId : undefined);
    return NextResponse.json({ ok: true, relations });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити пов’язані товари.' }, { status: 500 });
  }
}
