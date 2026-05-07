import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { parseSeoRulesFromUnknown } from '@/lib/seo-settings';
import { getSeoRulesFromDb, saveSeoRulesToDb } from '@/lib/seo-rules-repository';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const rules = await getSeoRulesFromDb();
    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as { rules?: unknown };
    const rules = parseSeoRulesFromUnknown(body?.rules);

    await saveSeoRulesToDb(rules);

    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
