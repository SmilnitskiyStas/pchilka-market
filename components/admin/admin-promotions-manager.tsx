'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { PromotionRecord } from '@/lib/promotion-types';
import AdminPromotionCatalogManager from '@/components/admin/admin-promotion-catalog-manager';
import AdminShockPriceManager from '@/components/admin/admin-shock-price-manager';
import {
  defaultShockPriceSettings,
  normalizeShockPriceSettings,
  type ShockPriceSettings,
  type ShockPriceSortOrder
} from '@/lib/shock-price-settings';

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchPromotions(): Promise<PromotionRecord[]> {
  const response = await fetch('/api/admin/promotions', { cache: 'no-store' });
  const payload = (await response.json()) as { ok?: boolean; promotions?: PromotionRecord[]; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося завантажити акції.');
  }

  return Array.isArray(payload.promotions) ? payload.promotions : [];
}

async function savePromotions(promotions: PromotionRecord[]): Promise<PromotionRecord[]> {
  const response = await fetch('/api/admin/promotions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promotions })
  });

  const payload = (await response.json()) as { ok?: boolean; promotions?: PromotionRecord[]; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося зберегти акції.');
  }

  return Array.isArray(payload.promotions) ? payload.promotions : [];
}

async function fetchShockPriceSettings(): Promise<ShockPriceSettings> {
  const response = await fetch('/api/admin/shock-price/settings', { cache: 'no-store' });
  const payload = (await response.json()) as { ok?: boolean; settings?: Partial<ShockPriceSettings>; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося завантажити налаштування сторінки «Шок ціна».');
  }

  return normalizeShockPriceSettings(payload.settings);
}

async function saveShockPriceSettings(settings: ShockPriceSettings): Promise<ShockPriceSettings> {
  const response = await fetch('/api/admin/shock-price/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings })
  });

  const payload = (await response.json()) as { ok?: boolean; settings?: Partial<ShockPriceSettings>; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося зберегти налаштування сторінки «Шок ціна».');
  }

  return normalizeShockPriceSettings(payload.settings);
}

export default function AdminPromotionsManager() {
  const [activeTab, setActiveTab] = useState<'promotions' | 'catalog'>('promotions');
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [isWeekly, setIsWeekly] = useState(false);

  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const [shockSettings, setShockSettings] = useState<ShockPriceSettings>(defaultShockPriceSettings);
  const [isShockSaving, setIsShockSaving] = useState(false);
  const [shockError, setShockError] = useState('');
  const [shockSuccess, setShockSuccess] = useState('');

  const isEditing = editingId !== null;
  const sortedPromotions = useMemo(() => [...promotions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [promotions]);
  const previewSlug = normalizeSlug(slug || title);
  const currentPreviewHref = previewSlug ? `/promotions/${previewSlug}` : '';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const remote = await fetchPromotions();
        if (!cancelled) setPromotions(remote);
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : 'Не вдалося завантажити акції.';
        setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadShockSettings() {
      try {
        const remote = await fetchShockPriceSettings();
        if (!cancelled) setShockSettings(remote);
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : 'Не вдалося завантажити налаштування «Шок ціна».';
        setShockError(message);
      }
    }

    void loadShockSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setShortDescription('');
    setContent('');
    setImageUrl('');
    setStartsAt('');
    setEndsAt('');
    setStatus('draft');
    setIsWeekly(false);
    setError('');
  }

  async function persist(next: PromotionRecord[]) {
    setIsSyncing(true);
    try {
      const saved = await savePromotions(next);
      setPromotions(saved);
      setIsSaved(true);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Не вдалося зберегти акції.';
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedTitle = title.trim();
    const normalizedSlug = normalizeSlug(slug || title);

    if (!normalizedTitle || !normalizedSlug) {
      setError('Заповніть назву та slug акції.');
      return;
    }

    const duplicate = promotions.find((item) => item.slug === normalizedSlug && item.id !== editingId);
    if (duplicate) {
      setError('Акція з таким slug вже існує.');
      return;
    }

    const draft: PromotionRecord = {
      id: editingId ?? `promo_${Date.now()}`,
      slug: normalizedSlug,
      title: normalizedTitle,
      shortDescription: shortDescription.trim(),
      content: content.trim(),
      imageUrl: imageUrl.trim(),
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      status,
      isWeekly,
      updatedAt: new Date().toISOString()
    };

    const next = isEditing
      ? promotions.map((item) => (item.id === editingId ? draft : item))
      : [draft, ...promotions];

    await persist(next);
    resetForm();
  }

  function handleEdit(item: PromotionRecord) {
    setEditingId(item.id);
    setTitle(item.title);
    setSlug(item.slug);
    setShortDescription(item.shortDescription);
    setContent(item.content);
    setImageUrl(item.imageUrl);
    setStartsAt(item.startsAt ?? '');
    setEndsAt(item.endsAt ?? '');
    setStatus(item.status);
    setIsWeekly(item.isWeekly);
    setError('');
    setIsSaved(false);
  }

  async function handleDelete(id: string) {
    const next = promotions.filter((item) => item.id !== id);
    await persist(next);
    if (editingId === id) resetForm();
  }

  function updateShockSettings<K extends keyof ShockPriceSettings>(key: K, value: ShockPriceSettings[K]) {
    setShockSettings((prev) => ({ ...prev, [key]: value }));
    setShockSuccess('');
    setShockError('');
  }

  async function handleShockSettingsSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsShockSaving(true);
    setShockError('');
    setShockSuccess('');

    try {
      const saved = await saveShockPriceSettings({
        ...shockSettings,
        updatedAt: new Date().toISOString()
      });
      setShockSettings(saved);
      setShockSuccess('Налаштування сторінки «Шок ціна» збережено.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Не вдалося зберегти налаштування «Шок ціна».';
      setShockError(message);
    } finally {
      setIsShockSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Акції</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Керування акціями</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">CRUD для акцій зберігається у БД та доступний для подальшого підключення публічних сторінок.</p>
      {isLoading ? <p className="mt-2 text-sm font-semibold text-slate-600">Завантаження акцій з БД...</p> : null}

      <div className="mt-5 flex gap-2 border-b border-slate-200">
        <button type="button" onClick={() => setActiveTab('promotions')} className={`border-b-2 px-4 py-2 text-sm font-semibold ${activeTab === 'promotions' ? 'border-brand text-brand' : 'border-transparent text-slate-600'}`}>Акції</button>
        <button type="button" onClick={() => setActiveTab('catalog')} className={`border-b-2 px-4 py-2 text-sm font-semibold ${activeTab === 'catalog' ? 'border-brand text-brand' : 'border-transparent text-slate-600'}`}>Каталог</button>
      </div>

      {activeTab === 'catalog' ? <AdminPromotionCatalogManager /> : <>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900" htmlFor="promo-title">Назва акції</label>
          <input id="promo-title" value={title} onChange={(event) => { setTitle(event.target.value); setIsSaved(false); }} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900" htmlFor="promo-slug">Slug</label>
          <input id="promo-slug" value={slug} onChange={(event) => { setSlug(event.target.value); setIsSaved(false); }} placeholder="aktsiia-tyzhnia" className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand" />
          {currentPreviewHref ? (
            <p className="mt-2 text-xs text-slate-600">
              Посилання на акцію:{' '}
              <Link href={currentPreviewHref} target="_blank" rel="noreferrer" className="font-semibold text-brand underline underline-offset-2">
                {currentPreviewHref}
              </Link>
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900" htmlFor="promo-short">Короткий опис</label>
          <textarea id="promo-short" rows={3} value={shortDescription} onChange={(event) => { setShortDescription(event.target.value); setIsSaved(false); }} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900" htmlFor="promo-content">Опис акції</label>
          <textarea id="promo-content" rows={6} value={content} onChange={(event) => { setContent(event.target.value); setIsSaved(false); }} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-900" htmlFor="promo-image">Image URL</label>
            <input id="promo-image" value={imageUrl} onChange={(event) => { setImageUrl(event.target.value); setIsSaved(false); }} placeholder="/img/... або https://..." className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900" htmlFor="promo-status">Статус</label>
            <select id="promo-status" value={status} onChange={(event) => { setStatus(event.target.value as 'draft' | 'published' | 'archived'); setIsSaved(false); }} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand">
              <option value="draft">Чернетка</option>
              <option value="published">Опубліковано</option>
              <option value="archived">Архів</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-900" htmlFor="promo-start">Період з</label>
            <input id="promo-start" type="datetime-local" value={startsAt} onChange={(event) => { setStartsAt(event.target.value); setIsSaved(false); }} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900" htmlFor="promo-end">Період до</label>
            <input id="promo-end" type="datetime-local" value={endsAt} onChange={(event) => { setEndsAt(event.target.value); setIsSaved(false); }} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input type="checkbox" checked={isWeekly} onChange={(event) => { setIsWeekly(event.target.checked); setIsSaved(false); }} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
          Акція тижня
        </label>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {isSaved ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Акцію збережено.</p> : null}

        <div className="flex items-center justify-end gap-2">
          {isEditing ? (
            <button type="button" onClick={resetForm} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500">
              Скасувати редагування
            </button>
          ) : null}
          <button type="submit" disabled={isSyncing} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
            {isSyncing ? 'Збереження...' : isEditing ? 'Зберегти зміни' : 'Додати акцію'}
          </button>
        </div>
      </form>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Список акцій</h2>
          <p className="text-xs font-semibold text-slate-600">Усього: {sortedPromotions.length}</p>
        </div>

        {sortedPromotions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Акцій ще немає.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {sortedPromotions.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p><span className="font-semibold text-slate-900">Назва:</span> {item.title}</p>
                <p><span className="font-semibold text-slate-900">Slug:</span> {item.slug}</p>
                <p><span className="font-semibold text-slate-900">Статус:</span> {item.status}</p>
                <p><span className="font-semibold text-slate-900">Період:</span> {item.startsAt || '—'} - {item.endsAt || '—'}</p>
                <p className="mt-1">
                  <span className="font-semibold text-slate-900">Посилання:</span>{' '}
                  <Link
                    href={`/promotions/${item.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand underline underline-offset-2"
                  >
                    /promotions/{item.slug}
                  </Link>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => handleEdit(item)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand">
                    Редагувати
                  </button>
                  <Link
                    href={`/promotions/${item.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-brand/30 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/5"
                  >
                    Переглянути
                  </Link>
                  <button type="button" onClick={() => { void handleDelete(item.id); }} className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50">
                    Видалити
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Налаштування сторінки «Шок ціна»</h2>
        <p className="mt-2 text-sm text-slate-600">
          Керуйте відображенням галереї: порядок зображень, кількість карток та колонки на різних екранах.
        </p>

        <form onSubmit={handleShockSettingsSave} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="shock-mobile-cols" className="block text-sm font-semibold text-slate-900">Колонки (mobile)</label>
              <select
                id="shock-mobile-cols"
                value={shockSettings.columnsMobile}
                onChange={(event) => updateShockSettings('columnsMobile', Number(event.target.value))}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>

            <div>
              <label htmlFor="shock-tablet-cols" className="block text-sm font-semibold text-slate-900">Колонки (tablet)</label>
              <select
                id="shock-tablet-cols"
                value={shockSettings.columnsTablet}
                onChange={(event) => updateShockSettings('columnsTablet', Number(event.target.value))}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>

            <div>
              <label htmlFor="shock-desktop-cols" className="block text-sm font-semibold text-slate-900">Колонки (desktop)</label>
              <select
                id="shock-desktop-cols"
                value={shockSettings.columnsDesktop}
                onChange={(event) => updateShockSettings('columnsDesktop', Number(event.target.value))}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="shock-max-items" className="block text-sm font-semibold text-slate-900">Максимум зображень</label>
              <input
                id="shock-max-items"
                type="number"
                min={0}
                max={200}
                value={shockSettings.maxItems}
                onChange={(event) => updateShockSettings('maxItems', Number(event.target.value))}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />
              <p className="mt-1 text-xs text-slate-500">0 = показувати всі зображення.</p>
            </div>

            <div>
              <label htmlFor="shock-sort-order" className="block text-sm font-semibold text-slate-900">Порядок відображення</label>
              <select
                id="shock-sort-order"
                value={shockSettings.sortOrder}
                onChange={(event) => updateShockSettings('sortOrder', event.target.value as ShockPriceSortOrder)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              >
                <option value="newest">Новіші спочатку</option>
                <option value="oldest">Старіші спочатку</option>
                <option value="name_asc">За назвою (А-Я)</option>
                <option value="name_desc">За назвою (Я-А)</option>
              </select>
            </div>
          </div>

          {shockError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{shockError}</p> : null}
          {shockSuccess ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{shockSuccess}</p> : null}

          <button
            type="submit"
            disabled={isShockSaving}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isShockSaving ? 'Збереження...' : 'Зберегти налаштування «Шок ціна»'}
          </button>
        </form>
      </section>

      <AdminShockPriceManager />
      </>}
    </div>
  );
}

