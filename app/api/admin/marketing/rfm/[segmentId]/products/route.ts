import { NextRequest, NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getRfmSegmentTopProducts } from '@/lib/marketing-rfm';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ segmentId: string }> }) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const { segmentId } = await params;
    const rawStoreId = request.nextUrl.searchParams.get('storeId');
    const storeId = rawStoreId ? Number(rawStoreId) : undefined;
    const products = await getRfmSegmentTopProducts(Number(request.nextUrl.searchParams.get('days') ?? 180), segmentId, Number.isInteger(storeId) ? storeId : undefined);
    return NextResponse.json({ ok: true, products });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити товари.' }, { status: 500 });
  }
}
