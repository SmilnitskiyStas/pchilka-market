import { NextResponse } from 'next/server';

import { runUtilityMeterReadingReminders } from '@/lib/utility-meter-reminders';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const expectedSecret = process.env.UTILITY_METER_REMINDERS_SECRET?.trim() ?? '';
  if (!expectedSecret || request.headers.get('x-utility-meter-reminders-secret')?.trim() !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { periodMonth?: string };
    return NextResponse.json({ ok: true, result: await runUtilityMeterReadingReminders({ periodMonth: body.periodMonth }) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
