import { NextResponse } from 'next/server';

import { defaultIntegrationsSettings } from '@/lib/integrations-settings';
import { getIntegrationsSettingsFromDb } from '@/lib/integrations-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Browser tags need these IDs, which are intentionally public. Do not expose
 * administrative or AI integration settings from this route.
 */
export async function GET() {
  try {
    const settings = await getIntegrationsSettingsFromDb();

    return NextResponse.json(
      {
        ok: true,
        settings: {
          enabled: settings.enabled,
          environment: settings.environment,
          ga4MeasurementId: settings.ga4MeasurementId,
          gtmContainerId: settings.gtmContainerId,
          metaPixelId: settings.metaPixelId
        }
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch {
    // A database failure must not affect rendering of public pages.
    return NextResponse.json(
      {
        ok: false,
        settings: {
          enabled: defaultIntegrationsSettings.enabled,
          environment: defaultIntegrationsSettings.environment,
          ga4MeasurementId: defaultIntegrationsSettings.ga4MeasurementId,
          gtmContainerId: defaultIntegrationsSettings.gtmContainerId,
          metaPixelId: defaultIntegrationsSettings.metaPixelId
        }
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
