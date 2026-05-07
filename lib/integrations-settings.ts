export type AnalyticsEnvironment = 'prod' | 'dev';

export type IntegrationsSettings = {
  enabled: boolean;
  environment: AnalyticsEnvironment;
  ga4MeasurementId: string;
  gtmContainerId: string;
  metaPixelId: string;
  updatedAt: string;
};

export const ANALYTICS_SETTINGS_KEY = 'analytics_settings_v1';

export const defaultIntegrationsSettings: IntegrationsSettings = {
  enabled: false,
  environment: 'prod',
  ga4MeasurementId: '',
  gtmContainerId: '',
  metaPixelId: '',
  updatedAt: ''
};

export function normalizeIntegrationsSettings(raw: Partial<IntegrationsSettings> | null | undefined): IntegrationsSettings {
  return {
    enabled: raw?.enabled ?? false,
    environment: raw?.environment === 'dev' ? 'dev' : 'prod',
    ga4MeasurementId: (raw?.ga4MeasurementId ?? '').trim().toUpperCase(),
    gtmContainerId: (raw?.gtmContainerId ?? '').trim().toUpperCase(),
    metaPixelId: (raw?.metaPixelId ?? '').trim(),
    updatedAt: String(raw?.updatedAt ?? '')
  };
}

export function isValidGa4(value: string) {
  if (!value) return true;
  return /^G-[A-Z0-9]+$/i.test(value);
}

export function isValidGtm(value: string) {
  if (!value) return true;
  return /^GTM-[A-Z0-9]+$/i.test(value);
}

export function isValidMetaPixel(value: string) {
  if (!value) return true;
  return /^\d{5,32}$/.test(value);
}
