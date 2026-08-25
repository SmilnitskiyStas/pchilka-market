import { NextResponse } from 'next/server';
import { processCareerTelegramUpdate } from '@/lib/career-telegram-bot';
import { getCareerTelegramSettings } from '@/lib/career-telegram-settings-repository';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const settings = await getCareerTelegramSettings();
    if (!settings.webhookSecret || request.headers.get('x-telegram-bot-api-secret-token')?.trim() !== settings.webhookSecret) return NextResponse.json({ ok: false, error: 'Invalid webhook secret.' }, { status: 401 });
    return NextResponse.json({ ok: true, result: await processCareerTelegramUpdate(await request.json()) });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 }); }
}
