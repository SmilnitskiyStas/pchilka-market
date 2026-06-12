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
    console.error('[admin-inventory-notifications-run]', {
      message: error instanceof Error ? error.message : 'Unknown notification error',
      stack: error instanceof Error ? error.stack : undefined,
      code: typeof error === 'object' && error && 'code' in error ? (error as { code?: unknown }).code : undefined,
      sqlMessage:
        typeof error === 'object' && error && 'sqlMessage' in error
          ? (error as { sqlMessage?: unknown }).sqlMessage
          : undefined,
      sql: typeof error === 'object' && error && 'sql' in error ? (error as { sql?: unknown }).sql : undefined
    });
    const message = error instanceof Error ? error.message : 'Unknown notification error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
