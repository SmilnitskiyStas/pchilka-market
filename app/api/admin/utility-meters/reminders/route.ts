import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { runUtilityMeterReadingReminders } from '@/lib/utility-meter-reminders';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const body = (await request.json().catch(() => ({}))) as { periodMonth?: string };
    return NextResponse.json({ ok: true, result: await runUtilityMeterReadingReminders({ periodMonth: body.periodMonth }) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
