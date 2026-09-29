import { NextResponse } from 'next/server';

import { listUtilityMeterConsumptionStatisticsInDb } from '@/lib/utility-metering-repository';

export const runtime = 'nodejs';

const MONTH_PATTERN = /^\d{4}-\d{2}-01$/;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const periodFrom = url.searchParams.get('periodFrom') ?? '';
    const periodTo = url.searchParams.get('periodTo') ?? '';
    const storeIds = url.searchParams.getAll('storeId');
    const regions = url.searchParams.getAll('region');

    if (!MONTH_PATTERN.test(periodFrom) || !MONTH_PATTERN.test(periodTo) || periodFrom > periodTo) {
      return NextResponse.json({ ok: false, error: 'Вкажіть коректний період від і до у форматі YYYY-MM-01.' }, { status: 400 });
    }

    const items = await listUtilityMeterConsumptionStatisticsInDb({ periodFrom, periodTo, storeIds, regions });
    const totals = items.reduce(
      (acc, item) => ({
        meters: acc.meters + 1,
        readings: acc.readings + item.readings,
        consumption: acc.consumption + item.consumption,
        amount: acc.amount + item.amount
      }),
      { meters: 0, readings: 0, consumption: 0, amount: 0 }
    );

    return NextResponse.json({
      ok: true,
      items,
      totals: {
        ...totals,
        consumption: Math.round(totals.consumption * 10000) / 10000,
        amount: Math.round(totals.amount * 100) / 100
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
