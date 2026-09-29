import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { previewUtilityMeterReadingReminders, runUtilityMeterReadingReminders } from '@/lib/utility-meter-reminders';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const body = (await request.json().catch(() => ({}))) as { periodMonth?: string; preview?: boolean };
    if (body.preview) {
      return NextResponse.json({ ok: true, preview: await previewUtilityMeterReadingReminders({ periodMonth: body.periodMonth }) });
    }
    return NextResponse.json({ ok: true, result: await runUtilityMeterReadingReminders({ periodMonth: body.periodMonth }) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
