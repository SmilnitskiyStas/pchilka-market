import { hasAnalyticsConsent } from '@/lib/analytics-consent';

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

function sanitize(payload: AnalyticsPayload): Record<string, string | number | boolean | null> {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as Record<string, string | number | boolean | null>;
}

export function trackAnalyticsEvent(eventName: string, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent()) return;

  const eventPayload = sanitize(payload);
  const withEvent = { event: eventName, ...eventPayload };

  const globalScope = window as typeof window & {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  };

  if (typeof globalScope.gtag === 'function') {
    globalScope.gtag('event', eventName, eventPayload);
  }

  if (Array.isArray(globalScope.dataLayer)) {
    globalScope.dataLayer.push(withEvent);
  }

  if (typeof globalScope.fbq === 'function') {
    globalScope.fbq('trackCustom', eventName, eventPayload);
  }
}
