import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getAllStoreInventoryAssortmentComparisonByDatesInDb } from '@/lib/inventory-store-assortment-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const url = new URL(request.url);
    const baselineDate = String(url.searchParams.get('baselineDate') ?? '').trim();
    const targetDate = String(url.searchParams.get('targetDate') ?? '').trim();
    if (!baselineDate || !targetDate) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати дві дати для порівняння.' }, { status: 400 });
    }

    const comparison = await getAllStoreInventoryAssortmentComparisonByDatesInDb(baselineDate, targetDate);
    return NextResponse.json({ ok: true, comparison });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося завантажити порівняння по всіх магазинах.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
