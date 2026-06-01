import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { listInventoryNotificationLogsFromDb } from '@/lib/inventory-notification-logs-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const result = await listInventoryNotificationLogsFromDb({
      storeId: url.searchParams.get('storeId'),
      dateFrom: url.searchParams.get('dateFrom'),
      dateTo: url.searchParams.get('dateTo'),
      limit: Number(url.searchParams.get('limit') ?? 50),
      page: Number(url.searchParams.get('page') ?? 1)
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося завантажити журнал сповіщень.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
