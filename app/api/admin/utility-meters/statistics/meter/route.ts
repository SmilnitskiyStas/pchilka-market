import { NextResponse } from 'next/server';

import { listUtilityMeterConsumptionHistoryInDb } from '@/lib/utility-metering-repository';

export const runtime = 'nodejs';

const MONTH_PATTERN = /^\d{4}-\d{2}-01$/;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const meterPointId = url.searchParams.get('meterPointId') ?? '';
    const periodFrom = url.searchParams.get('periodFrom') ?? '';
    const periodTo = url.searchParams.get('periodTo') ?? '';

    if (!meterPointId || !MONTH_PATTERN.test(periodFrom) || !MONTH_PATTERN.test(periodTo) || periodFrom > periodTo) {
      return NextResponse.json({ ok: false, error: 'Вкажіть лічильник і коректний період.' }, { status: 400 });
    }

    const items = await listUtilityMeterConsumptionHistoryInDb({ meterPointId, periodFrom, periodTo });
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
