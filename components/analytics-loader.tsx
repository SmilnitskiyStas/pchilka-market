'use client';

import { useEffect, useState } from 'react';

import {
  ANALYTICS_CONSENT_EVENT_NAME,
  ANALYTICS_CONSENT_STORAGE_KEY,
  hasAnalyticsConsent,
  readAnalyticsConsent
} from '@/lib/analytics-consent';
import {
  defaultIntegrationsSettings,
  normalizeIntegrationsSettings,
  type IntegrationsSettings
} from '@/lib/integrations-settings';

const analyticsScriptIds = [
  'analytics-ga4-src',
  'analytics-ga4-inline',
  'analytics-gtm-src',
  'analytics-gtm-inline',
  'analytics-meta-inline'
];

function removeByIds(ids: string[]) {
  ids.forEach((id) => document.getElementById(id)?.remove());
}

function appendInlineScript(id: string, content: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.text = content;
  document.head.appendChild(script);
}

function appendExternalScript(id: string, src: string, async = true) {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.src = src;
  script.async = async;
  document.head.appendChild(script);
}

function shouldEnableForCurrentHost(environment: 'prod' | 'dev') {
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  return environment === 'dev' ? isLocal : !isLocal;
}

async function loadSettings(): Promise<IntegrationsSettings> {
  try {
    const response = await fetch('/api/admin/integrations', { cache: 'no-store' });
    const payload = (await response.json()) as { ok?: boolean; settings?: Partial<IntegrationsSettings> };
    if (!response.ok || !payload.ok) return defaultIntegrationsSettings;
    return normalizeIntegrationsSettings(payload.settings);
  } catch {
    return defaultIntegrationsSettings;
  }
}

export default function AnalyticsLoader() {
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    setConsentAccepted(hasAnalyticsConsent());

    function handleLocalChange() {
      setConsentAccepted(readAnalyticsConsent() === 'accepted');
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key !== ANALYTICS_CONSENT_STORAGE_KEY) return;
      handleLocalChange();
    }

    window.addEventListener(ANALYTICS_CONSENT_EVENT_NAME, handleLocalChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT_NAME, handleLocalChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!consentAccepted) {
      removeByIds(analyticsScriptIds);
      return () => {
        cancelled = true;
      };
    }

    async function init() {
      const settings = await loadSettings();
      if (cancelled) return;

      if (!settings.enabled) return;
      if (!shouldEnableForCurrentHost(settings.environment)) return;

      const hasValidGa4 = /^G-[A-Z0-9]+$/i.test(settings.ga4MeasurementId);
      if (hasValidGa4) {
        appendExternalScript('analytics-ga4-src', `https://www.googletagmanager.com/gtag/js?id=${settings.ga4MeasurementId}`);
        appendInlineScript(
          'analytics-ga4-inline',
          `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('js', new Date());gtag('config', '${settings.ga4MeasurementId}');`
        );
      }

      const hasValidGtm = /^GTM-[A-Z0-9]+$/i.test(settings.gtmContainerId);
      if (hasValidGtm) {
        appendInlineScript(
          'analytics-gtm-inline',
          `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.id='analytics-gtm-src';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode&&f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${settings.gtmContainerId}');`
        );
      }

      const hasValidMetaPixel = /^\d{5,32}$/.test(settings.metaPixelId);
      if (hasValidMetaPixel) {
        appendInlineScript(
          'analytics-meta-inline',
          `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode&&s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${settings.metaPixelId}');fbq('track','PageView');`
        );
      }
    }

    void init();

    return () => {
      cancelled = true;
      removeByIds(analyticsScriptIds);
    };
  }, [consentAccepted]);

  return null;
}
