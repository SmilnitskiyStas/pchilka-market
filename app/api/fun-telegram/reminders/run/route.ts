import { NextResponse } from 'next/server';
import { runFunTelegramReminders } from '@/lib/fun-telegram-reminders';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const expectedSecret = process.env.FUN_TELEGRAM_REMINDERS_SECRET?.trim() ?? '';
  if (!expectedSecret || request.headers.get('x-fun-telegram-reminders-secret')?.trim() !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, result: await runFunTelegramReminders() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
