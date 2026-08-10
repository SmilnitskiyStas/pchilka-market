import { NextRequest, NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getRfmSegmentBehavior } from '@/lib/marketing-rfm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ segmentId: string }> }) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const { segmentId } = await params;
    const behavior = await getRfmSegmentBehavior(Number(request.nextUrl.searchParams.get('days') ?? 180), segmentId);
    return NextResponse.json({ ok: true, behavior });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити поведінку.' }, { status: 500 });
  }
}
