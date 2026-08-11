import { NextRequest, NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getRfmAiAdvice } from '@/lib/marketing-rfm-ai';
import { getRfmReport, getRfmSegmentBehavior, getRfmSegmentDetailForStore, getRfmSegmentTopProducts } from '@/lib/marketing-rfm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const body = await request.json() as { days?: unknown; storeId?: unknown; segmentId?: unknown; storeName?: unknown; question?: unknown };
    const days = [90, 180, 365].includes(Number(body.days)) ? Number(body.days) : 180;
    const storeId = typeof body.storeId === 'string' && /^\d+$/.test(body.storeId) ? Number(body.storeId) : undefined;
    const segmentId = typeof body.segmentId === 'string' ? body.segmentId : undefined;
    const report = await getRfmReport(days, storeId);
    const [detail, behavior, products] = segmentId
      ? await Promise.all([
        getRfmSegmentDetailForStore(days, segmentId, storeId),
        getRfmSegmentBehavior(days, segmentId, storeId),
        getRfmSegmentTopProducts(days, segmentId, storeId)
      ])
      : [undefined, undefined, undefined];
    const advice = await getRfmAiAdvice({
      report,
      detail,
      behavior,
      products,
      storeName: typeof body.storeName === 'string' ? body.storeName.slice(0, 120) : undefined,
      question: typeof body.question === 'string' ? body.question : undefined
    });
    return NextResponse.json({ ok: true, advice });
  } catch (error) {
    console.error('[marketing-rfm-ai-advice]', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося отримати рекомендації AI-помічника.' }, { status: 500 });
  }
}
