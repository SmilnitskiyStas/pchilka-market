export type AnalyticsEnvironment = 'prod' | 'dev';

export type IntegrationsSettings = {
  enabled: boolean;
  environment: AnalyticsEnvironment;
  ga4MeasurementId: string;
  gtmContainerId: string;
  metaPixelId: string;
  aiEnabled: boolean;
  aiModel: string;
  aiApiKeyConfigured: boolean;
  updatedAt: string;
};

export const ANALYTICS_SETTINGS_KEY = 'analytics_settings_v1';

export const defaultIntegrationsSettings: IntegrationsSettings = {
  enabled: false,
  environment: 'prod',
  ga4MeasurementId: '',
  gtmContainerId: '',
  metaPixelId: '',
  aiEnabled: false,
  aiModel: 'gpt-5.6-luna',
  aiApiKeyConfigured: false,
  updatedAt: ''
};

export function normalizeIntegrationsSettings(raw: Partial<IntegrationsSettings> | null | undefined): IntegrationsSettings {
  return {
    enabled: raw?.enabled ?? false,
    environment: raw?.environment === 'dev' ? 'dev' : 'prod',
    ga4MeasurementId: (raw?.ga4MeasurementId ?? '').trim().toUpperCase(),
    gtmContainerId: (raw?.gtmContainerId ?? '').trim().toUpperCase(),
    metaPixelId: (raw?.metaPixelId ?? '').trim(),
    aiEnabled: raw?.aiEnabled === true,
    aiModel: isValidAiModel(String(raw?.aiModel ?? '')) ? String(raw?.aiModel).trim() || 'gpt-5.6-luna' : 'gpt-5.6-luna',
    aiApiKeyConfigured: raw?.aiApiKeyConfigured === true,
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

export function isValidAiModel(value: string) {
  return !value || /^[a-zA-Z0-9._:-]{2,100}$/.test(value.trim());
}
