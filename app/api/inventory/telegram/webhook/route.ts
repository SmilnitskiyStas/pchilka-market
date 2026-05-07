import { NextResponse } from 'next/server';

import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { processInventoryTelegramUpdate } from '@/lib/inventory-telegram-bot';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const settings = await getInventoryTelegramSettingsFromDb();

    if (!settings.enabled) {
      return NextResponse.json({ ok: false, error: 'Telegram inventory integration is disabled.' }, { status: 503 });
    }

    const secret = request.headers.get('x-telegram-bot-api-secret-token')?.trim() ?? '';
    if (!settings.webhookSecret || secret !== settings.webhookSecret) {
      return NextResponse.json({ ok: false, error: 'Invalid webhook secret.' }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as unknown;

    const result = await processInventoryTelegramUpdate((payload ?? {}) as Record<string, unknown>);

    return NextResponse.json({
      ok: true,
      accepted: true,
      mode: 'active',
      hasPayload: payload != null,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
