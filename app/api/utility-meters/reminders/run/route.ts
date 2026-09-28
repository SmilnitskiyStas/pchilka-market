import { NextResponse } from 'next/server';

import { runUtilityMeterReadingReminders } from '@/lib/utility-meter-reminders';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Reuse the existing inventory trigger secret until a deployment has a dedicated one.
  // This avoids silently disabling the built-in scheduler during an upgrade.
  const expectedSecret = (
    process.env.UTILITY_METER_REMINDERS_SECRET
    || process.env.INVENTORY_NOTIFY_SECRET
    || process.env.INVENTORY_WEBHOOK_SECRET
    || ''
  ).trim();
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
