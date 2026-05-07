import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  getShockPriceSettingsFromDb,
  saveShockPriceSettingsToDb
} from '@/lib/shock-price-settings-repository';
import {
  normalizeShockPriceSettings,
  type ShockPriceSettings
} from '@/lib/shock-price-settings';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const settings = await getShockPriceSettingsFromDb();
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
    const body = (await request.json()) as { settings?: Partial<ShockPriceSettings> };
    const normalized = normalizeShockPriceSettings({
      ...body?.settings,
      updatedAt: new Date().toISOString()
    });

    const saved = await saveShockPriceSettingsToDb(normalized);
    return NextResponse.json({ ok: true, settings: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
