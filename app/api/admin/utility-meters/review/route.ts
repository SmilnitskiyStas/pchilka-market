import { NextResponse } from 'next/server';

import { findStoreByIdInDb } from '@/lib/stores-repository';
import { listUtilityMeterReviewInDb } from '@/lib/utility-metering-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const periodMonth = url.searchParams.get('periodMonth') ?? '';
    const storeId = url.searchParams.get('storeId') || null;

    if (!/^\d{4}-\d{2}-01$/.test(periodMonth)) {
      return NextResponse.json({ ok: false, error: 'Некоректний період. Очікується YYYY-MM-01.' }, { status: 400 });
    }

    const store = storeId ? await findStoreByIdInDb(storeId) : null;
    const items = await listUtilityMeterReviewInDb({
      periodMonth,
      storeId,
      storeCode: store?.storeCode
    });
    const totals = items.reduce(
      (acc, item) => {
        acc.meters += 1;
        if (item.reading) acc.submitted += 1;
        if (item.charge?.validationStatus === 'ok') acc.ok += 1;
        if (item.charge?.validationStatus === 'warning') acc.warning += 1;
        if (item.charge?.validationStatus === 'error') acc.error += 1;
        acc.amount += item.charge?.amount ?? 0;
        return acc;
      },
      { meters: 0, submitted: 0, ok: 0, warning: 0, error: 0, amount: 0 }
    );

    return NextResponse.json({ ok: true, items, totals: { ...totals, amount: Math.round(totals.amount * 100) / 100 } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
