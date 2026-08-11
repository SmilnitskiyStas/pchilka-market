'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  defaultIntegrationsSettings,
  isValidGa4,
  isValidGtm,
  isValidMetaPixel,
  normalizeIntegrationsSettings,
  type IntegrationsSettings
} from '@/lib/integrations-settings';

function formatDate(value: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('uk-UA');
}

async function fetchSettings(): Promise<IntegrationsSettings> {
  const response = await fetch('/api/admin/integrations', { cache: 'no-store' });
  const payload = (await response.json()) as { ok?: boolean; settings?: Partial<IntegrationsSettings>; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося завантажити налаштування аналітики.');
  }

  return normalizeIntegrationsSettings(payload.settings);
}

async function saveSettings(settings: IntegrationsSettings, aiApiKey?: string, clearAiApiKey = false): Promise<IntegrationsSettings> {
  const response = await fetch('/api/admin/integrations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, aiApiKey, clearAiApiKey })
  });

  const payload = (await response.json()) as { ok?: boolean; settings?: Partial<IntegrationsSettings>; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося зберегти налаштування аналітики.');
  }

  return normalizeIntegrationsSettings(payload.settings);
}

export default function AdminIntegrationsManager() {
  const [settings, setSettings] = useState<IntegrationsSettings>(defaultIntegrationsSettings);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [aiApiKey, setAiApiKey] = useState('');

  const activeServicesCount = useMemo(() => {
    let count = 0;
    if (settings.ga4MeasurementId) count += 1;
    if (settings.gtmContainerId) count += 1;
    if (settings.metaPixelId) count += 1;
    if (settings.aiEnabled && settings.aiApiKeyConfigured) count += 1;
    return count;
  }, [settings.aiEnabled, settings.aiApiKeyConfigured, settings.ga4MeasurementId, settings.gtmContainerId, settings.metaPixelId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const loaded = await fetchSettings();
        if (!cancelled) {
          setSettings(loaded);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : 'Не вдалося завантажити налаштування.';
          setError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof IntegrationsSettings>(key: K, value: IntegrationsSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsSaved(false);
    if (error) setError('');
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ga4 = settings.ga4MeasurementId.trim().toUpperCase();
    const gtm = settings.gtmContainerId.trim().toUpperCase();
    const pixel = settings.metaPixelId.trim();

    if (!isValidGa4(ga4)) {
      setError('Некоректний GA4 Measurement ID. Приклад: G-ABC123XYZ9.');
      return;
    }

    if (!isValidGtm(gtm)) {
      setError('Некоректний GTM Container ID. Приклад: GTM-ABC1234.');
      return;
    }

    if (!isValidMetaPixel(pixel)) {
      setError('Некоректний Meta Pixel ID. Дозволені тільки цифри.');
      return;
    }

    setIsSyncing(true);

    try {
      const saved = await saveSettings({
        ...settings,
        ga4MeasurementId: ga4,
        gtmContainerId: gtm,
        metaPixelId: pixel,
        updatedAt: new Date().toISOString()
      }, aiApiKey);
      setSettings(saved);
      setAiApiKey('');
      setIsSaved(true);
      setError('');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Не вдалося зберегти налаштування.';
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleReset() {
    setIsSyncing(true);

    try {
      const saved = await saveSettings({
        ...defaultIntegrationsSettings,
        updatedAt: new Date().toISOString()
      }, undefined, true);
      setSettings(saved);
      setAiApiKey('');
      setError('');
      setIsSaved(true);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Не вдалося скинути налаштування.';
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Інтеграції</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Інтеграції аналітики</h1>
        <p className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
          Активних сервісів: {activeServicesCount}
        </p>
      </div>

      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        Налаштування зберігаються у БД та застосовуються на публічних сторінках після збереження.
      </p>

      <form onSubmit={handleSave} className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => update('enabled', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          Увімкнути інтеграції аналітики
        </label>

        <div>
          <label htmlFor="analytics-env" className="block text-sm font-semibold text-slate-900">
            Середовище
          </label>
          <select
            id="analytics-env"
            value={settings.environment}
            onChange={(event) => update('environment', event.target.value as 'prod' | 'dev')}
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          >
            <option value="prod">prod (бойове)</option>
            <option value="dev">dev (локальна перевірка)</option>
          </select>
        </div>

        <section className="rounded-xl border border-brand/25 bg-brand/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">AI-помічник для RFM-аналізу</h2>
              <p className="mt-1 text-xs text-slate-600">Використовується у розділі «Маркетинг → RFM-аналіз» для плану дій та рекомендацій.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input type="checkbox" checked={settings.aiEnabled} onChange={(event) => update('aiEnabled', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
              Увімкнути AI
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ai-model" className="block text-sm font-semibold text-slate-900">AI-модель</label>
              <input id="ai-model" value={settings.aiModel} onChange={(event) => update('aiModel', event.target.value)} placeholder="gpt-5.6-luna" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none transition focus:border-brand" />
            </div>
            <div>
              <label htmlFor="ai-api-key" className="block text-sm font-semibold text-slate-900">OpenAI API key</label>
              <input id="ai-api-key" type="password" value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} autoComplete="new-password" placeholder={settings.aiApiKeyConfigured ? 'Ключ збережено — введіть для заміни' : 'sk-...'} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none transition focus:border-brand" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><p className={settings.aiApiKeyConfigured ? 'font-semibold text-emerald-700' : 'text-slate-600'}>{settings.aiApiKeyConfigured ? 'API key збережено в зашифрованому вигляді.' : 'API key ще не додано.'}</p>{settings.aiApiKeyConfigured ? <button type="button" disabled={isSyncing} onClick={() => { void saveSettings(settings, undefined, true).then((saved) => { setSettings(saved); setIsSaved(true); }).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Не вдалося видалити API key.')); }} className="font-semibold text-red-700 hover:underline disabled:opacity-60">Видалити ключ</button> : null}</div>
        </section>

        <div>
          <label htmlFor="ga4-id" className="block text-sm font-semibold text-slate-900">
            GA4 Measurement ID
          </label>
          <input
            id="ga4-id"
            value={settings.ga4MeasurementId}
            onChange={(event) => update('ga4MeasurementId', event.target.value)}
            placeholder="G-XXXXXXXXXX"
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <div>
          <label htmlFor="gtm-id" className="block text-sm font-semibold text-slate-900">
            GTM Container ID
          </label>
          <input
            id="gtm-id"
            value={settings.gtmContainerId}
            onChange={(event) => update('gtmContainerId', event.target.value)}
            placeholder="GTM-XXXXXXX"
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <div>
          <label htmlFor="meta-pixel-id" className="block text-sm font-semibold text-slate-900">
            Meta Pixel ID
          </label>
          <input
            id="meta-pixel-id"
            value={settings.metaPixelId}
            onChange={(event) => update('metaPixelId', event.target.value)}
            placeholder="123456789012345"
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Останнє оновлення: <span className="font-semibold">{formatDate(settings.updatedAt)}</span>
        </div>

        {isLoading ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            Завантаження налаштувань...
          </p>
        ) : null}
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {isSaved ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            Налаштування збережено.
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              void handleReset();
            }}
            disabled={isSyncing}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition enabled:hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Скинути
          </button>
          <button
            type="submit"
            disabled={isSyncing}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
      </form>
    </div>
  );
}
