import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { findInventoryNotificationLogDetailsByIdInDb } from '@/lib/inventory-notification-logs-repository';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const { notificationId } = await context.params;
    const log = await findInventoryNotificationLogDetailsByIdInDb(notificationId);
    if (!log) {
      return NextResponse.json({ ok: false, error: 'Повідомлення не знайдено.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося завантажити повідомлення.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
