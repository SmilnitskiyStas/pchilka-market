import { NextResponse } from 'next/server';

import { runInventoryExpiryNotifications } from '@/lib/inventory-telegram-notifications';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const settings = await getInventoryTelegramSettingsFromDb();
    const secret = request.headers.get('x-inventory-notify-secret')?.trim() ?? '';
    const envSecret = process.env.INVENTORY_NOTIFY_SECRET?.trim() || process.env.INVENTORY_WEBHOOK_SECRET?.trim() || '';
    const allowedSecrets = [settings.webhookSecret, envSecret].filter(Boolean);
    if (allowedSecrets.length === 0 || !allowedSecrets.includes(secret)) {
      return NextResponse.json({ ok: false, error: 'Invalid notify secret.' }, { status: 401 });
    }

    const result = await runInventoryExpiryNotifications();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('[inventory-notifications-run]', {
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
