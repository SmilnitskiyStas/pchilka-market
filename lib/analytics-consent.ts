export type AnalyticsConsentState = 'accepted' | 'rejected' | 'unset';

export const ANALYTICS_CONSENT_STORAGE_KEY = 'analytics_consent_v1';
export const ANALYTICS_CONSENT_EVENT_NAME = 'analytics-consent-changed';

export function readAnalyticsConsent(): AnalyticsConsentState {
  if (typeof window === 'undefined') return 'unset';

  const raw = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
  if (raw === 'accepted' || raw === 'rejected') return raw;
  return 'unset';
}

export function writeAnalyticsConsent(value: Extract<AnalyticsConsentState, 'accepted' | 'rejected'>) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT_NAME, { detail: value }));
}

export function hasAnalyticsConsent(): boolean {
  return readAnalyticsConsent() === 'accepted';
}
