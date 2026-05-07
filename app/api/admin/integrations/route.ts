import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  isValidGa4,
  isValidGtm,
  isValidMetaPixel,
  normalizeIntegrationsSettings,
  type IntegrationsSettings
} from '@/lib/integrations-settings';
import { getIntegrationsSettingsFromDb, saveIntegrationsSettingsToDb } from '@/lib/integrations-repository';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const settings = await getIntegrationsSettingsFromDb();
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
    const body = (await request.json()) as { settings?: Partial<IntegrationsSettings> };
    const normalized = normalizeIntegrationsSettings(body?.settings);

    if (!isValidGa4(normalized.ga4MeasurementId)) {
      return NextResponse.json({ ok: false, error: 'Некоректний GA4 Measurement ID.' }, { status: 400 });
    }
    if (!isValidGtm(normalized.gtmContainerId)) {
      return NextResponse.json({ ok: false, error: 'Некоректний GTM Container ID.' }, { status: 400 });
    }
    if (!isValidMetaPixel(normalized.metaPixelId)) {
      return NextResponse.json({ ok: false, error: 'Некоректний Meta Pixel ID.' }, { status: 400 });
    }

    const saved = await saveIntegrationsSettingsToDb({
      ...normalized,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ ok: true, settings: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
