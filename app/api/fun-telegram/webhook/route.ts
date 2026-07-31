import { NextResponse } from 'next/server';

import { processFunTelegramUpdate } from '@/lib/fun-telegram-bot';
import { getFunTelegramSettings } from '@/lib/fun-telegram-settings-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const settings = await getFunTelegramSettings();
    const secret = request.headers.get('x-telegram-bot-api-secret-token')?.trim();
    if (!settings.webhookSecret || secret !== settings.webhookSecret) {
      return NextResponse.json({ ok: false, error: 'Invalid webhook secret.' }, { status: 401 });
    }
    const update = (await request.json()) as Record<string, unknown>;
    const result = await processFunTelegramUpdate(update);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
