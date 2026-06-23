import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getInventoryBatchAnalyticsMetricsFromDb } from '@/lib/inventory-batches-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const metrics = await getInventoryBatchAnalyticsMetricsFromDb({
      storeId: url.searchParams.get('storeId'),
      dateFrom: url.searchParams.get('dateFrom'),
      dateTo: url.searchParams.get('dateTo')
    });

    return NextResponse.json({ ok: true, metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
