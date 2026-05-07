import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { runInventoryExpiryNotifications } from '@/lib/inventory-telegram-notifications';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const result = await runInventoryExpiryNotifications();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown notification error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
