import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getSiteProfileFromDb, saveSiteProfileToDb } from '@/lib/site-profile-repository';
import { normalizeSiteProfileSettings, type SiteProfileSettings } from '@/lib/site-profile-settings';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const settings = await getSiteProfileFromDb();
    return NextResponse.json({ ok: true, settings });
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
    const body = (await request.json()) as { settings?: Partial<SiteProfileSettings> };
    const normalized = normalizeSiteProfileSettings(body?.settings);
    const saved = await saveSiteProfileToDb({
      ...normalized,
      updatedAt: new Date().toISOString()
    });
    return NextResponse.json({ ok: true, settings: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
