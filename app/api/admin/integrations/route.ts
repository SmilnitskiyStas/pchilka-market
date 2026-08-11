import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  isValidGa4,
  isValidAiModel,
  isValidGtm,
  isValidMetaPixel,
  normalizeIntegrationsSettings,
  type IntegrationsSettings
} from '@/lib/integrations-settings';
import { getIntegrationsSettingsFromDb, saveIntegrationsSettingsToDb } from '@/lib/integrations-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }
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
    const body = (await request.json()) as { settings?: Partial<IntegrationsSettings>; aiApiKey?: string; clearAiApiKey?: boolean };
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
    if (!isValidAiModel(normalized.aiModel)) {
      return NextResponse.json({ ok: false, error: 'Некоректна назва AI-моделі.' }, { status: 400 });
    }
    if (typeof body.aiApiKey !== 'undefined' && (typeof body.aiApiKey !== 'string' || body.aiApiKey.length > 500)) {
      return NextResponse.json({ ok: false, error: 'Некоректний AI API key.' }, { status: 400 });
    }

    const saved = await saveIntegrationsSettingsToDb({
      ...normalized,
      updatedAt: new Date().toISOString()
    }, { aiApiKey: body.aiApiKey, clearAiApiKey: body.clearAiApiKey === true });

    return NextResponse.json({ ok: true, settings: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
