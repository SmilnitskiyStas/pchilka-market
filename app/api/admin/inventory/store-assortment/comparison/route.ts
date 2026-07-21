import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  getStoreInventoryAssortmentComparisonByDatesInDb,
  listStoreInventoryAssortmentSnapshotsInDb
} from '@/lib/inventory-store-assortment-repository';

export const runtime = 'nodejs';

function parseStoreId(raw: string | null) {
  const value = Number(raw ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const storeId = parseStoreId(url.searchParams.get('storeId'));
    const baselineDate = String(url.searchParams.get('baselineDate') ?? '').trim();
    const targetDate = String(url.searchParams.get('targetDate') ?? '').trim();

    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати магазин.' }, { status: 400 });
    }
    if (!baselineDate || !targetDate) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати дві дати для порівняння.' }, { status: 400 });
    }

    const [comparison, history] = await Promise.all([
      getStoreInventoryAssortmentComparisonByDatesInDb(storeId, baselineDate, targetDate),
      listStoreInventoryAssortmentSnapshotsInDb(storeId, { limit: 12 })
    ]);

    return NextResponse.json({ ok: true, comparison, history });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося завантажити порівняння заповненості магазину.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
