'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { defaultHomeBanners, type HomeBanner } from '@/content/home-banners';
import { mainMenu } from '@/content/menu';
import { parseBannerDateTimeMs } from '@/lib/banner-datetime';

type BannerLinkOption = {
  label: string;
  href: string;
};

function isValidImagePath(value: string) {
  return (
    value.startsWith('/img/') ||
    value.startsWith('/uploads/') ||
    value.startsWith('/media/') ||
    value.startsWith('data:image/') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  );
}

function shouldUseNativeImage(src: string): boolean {
  return src.startsWith('/media/') || src.startsWith('http://') || src.startsWith('https://');
}

function normalizeImagePathInput(value: string): string {
  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized) return normalized;

  if (normalized.startsWith('/public/')) {
    return normalized.slice('/public'.length);
  }

  if (normalized.startsWith('public/')) {
    return `/${normalized.slice('public/'.length)}`;
  }

  if (normalized.startsWith('img/')) {
    return `/${normalized}`;
  }

  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }

  return normalized;
}

function buildBannerLinkOptions(): BannerLinkOption[] {
  const links: BannerLinkOption[] = [];

  mainMenu.forEach((item) => {
    if (item.children && item.children.length > 0) {
      item.children.forEach((child) => {
        if (child.href && child.href !== '#') {
          links.push({ label: `${item.label} -> ${child.label}`, href: child.href });
        }
      });
      return;
    }

    if (item.href && item.href !== '#') {
      links.push({ label: item.label, href: item.href });
    }
  });

  const unique = new Map<string, BannerLinkOption>();
  links.forEach((link) => {
    if (!unique.has(link.href)) unique.set(link.href, link);
  });

  return Array.from(unique.values());
}

async function uploadBannerImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'admin/banners');

  const response = await fetch('/api/admin/images', { method: 'POST', body: formData });
  const payload = (await response.json()) as { ok?: boolean; path?: string; error?: string };

  if (!response.ok || !payload.ok || !payload.path) {
    throw new Error(payload.error || 'Не вдалося завантажити файл банера на сервер.');
  }

  return payload.path;
}

async function fileFromDataUrl(dataUrl: string, index: number): Promise<File> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error('Не вдалося обробити base64-зображення банера.');
  }

  const blob = await response.blob();
  const mimeType = blob.type || 'image/png';
  const extension = mimeType.includes('/') ? mimeType.split('/')[1] : 'png';
  return new File([blob], `banner-${Date.now()}-${index}.${extension}`, { type: mimeType });
}

function normalizeBanner(raw: HomeBanner): HomeBanner {
  return {
    id: raw.id,
    alt: raw.alt,
    src: raw.src,
    href: raw.href,
    isActive: raw.isActive ?? true,
    publishFrom: raw.publishFrom,
    publishTo: raw.publishTo
  };
}

async function fetchBanners(): Promise<HomeBanner[]> {
  const response = await fetch('/api/admin/banners', { cache: 'no-store' });
  const payload = (await response.json()) as { ok?: boolean; banners?: HomeBanner[]; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося завантажити банери.');
  }

  return Array.isArray(payload.banners) ? payload.banners.map(normalizeBanner) : [];
}

async function saveBanners(banners: HomeBanner[]): Promise<HomeBanner[]> {
  const preparedBanners: HomeBanner[] = [];

  for (let index = 0; index < banners.length; index += 1) {
    const banner = banners[index];
    const normalizedSrc = normalizeImagePathInput(banner.src);

    if (normalizedSrc.startsWith('data:image/')) {
      const convertedFile = await fileFromDataUrl(normalizedSrc, index);
      const uploadedPath = await uploadBannerImage(convertedFile);
      preparedBanners.push({ ...banner, src: uploadedPath });
      continue;
    }

    preparedBanners.push({ ...banner, src: normalizedSrc });
  }

  const response = await fetch('/api/admin/banners', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ banners: preparedBanners })
  });

  const payload = (await response.json()) as { ok?: boolean; banners?: HomeBanner[]; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося зберегти банери.');
  }

  return Array.isArray(payload.banners) ? payload.banners.map(normalizeBanner) : [];
}

export default function AdminBannersManager() {
  const [banners, setBanners] = useState<HomeBanner[]>(defaultHomeBanners);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'scheduled' | 'live' | 'expired' | 'no_period'>('all');
  const [dateFilter, setDateFilter] = useState('');

  const [imageSourceMode, setImageSourceMode] = useState<'path' | 'upload'>('path');
  const [alt, setAlt] = useState('');
  const [src, setSrc] = useState('');
  const [selectedPageHref, setSelectedPageHref] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [publishFrom, setPublishFrom] = useState('');
  const [publishTo, setPublishTo] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const remote = await fetchBanners();
        if (!cancelled) setBanners(remote.length > 0 ? remote : defaultHomeBanners);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Не вдалося завантажити банери.';
        setFormError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedBanners = useMemo(() => [...banners], [banners]);
  const linkOptions = useMemo(() => buildBannerLinkOptions(), []);
  const isEditing = editingBannerId !== null;

  function getPublicationState(banner: HomeBanner) {
    const now = Date.now();
    const fromMs = parseBannerDateTimeMs(banner.publishFrom);
    const toMs = parseBannerDateTimeMs(banner.publishTo);

    if (!banner.publishFrom && !banner.publishTo) return 'no_period';
    if (fromMs !== null && !Number.isNaN(fromMs) && now < fromMs) return 'scheduled';
    if (toMs !== null && !Number.isNaN(toMs) && now > toMs) return 'expired';
    return 'live';
  }

  function matchesDateFilter(banner: HomeBanner, targetDate: string) {
    if (!targetDate) return true;

    const targetStart = new Date(`${targetDate}T00:00:00`).getTime();
    const targetEnd = new Date(`${targetDate}T23:59:59`).getTime();
    if (Number.isNaN(targetStart) || Number.isNaN(targetEnd)) return true;

    const fromMs = parseBannerDateTimeMs(banner.publishFrom);
    const toMs = parseBannerDateTimeMs(banner.publishTo);

    if (fromMs === null && toMs === null) return false;

    const startsBeforeOrOnDay = fromMs === null || fromMs <= targetEnd;
    const endsAfterOrOnDay = toMs === null || toMs >= targetStart;

    return startsBeforeOrOnDay && endsAfterOrOnDay;
  }

  const filteredBanners = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sortedBanners.filter((banner) => {
      const matchesName = normalizedQuery.length === 0 || banner.alt.toLowerCase().includes(normalizedQuery);
      const matchesActivity =
        activityFilter === 'all' || (activityFilter === 'active' ? banner.isActive : !banner.isActive);
      const matchesPeriod = periodFilter === 'all' || getPublicationState(banner) === periodFilter;
      const matchesDate = matchesDateFilter(banner, dateFilter);

      return matchesName && matchesActivity && matchesPeriod && matchesDate;
    });
  }, [activityFilter, dateFilter, periodFilter, searchQuery, sortedBanners]);

  function resetFilters() {
    setSearchQuery('');
    setActivityFilter('all');
    setPeriodFilter('all');
    setDateFilter('');
  }

  function resetForm() {
    setImageSourceMode('path');
    setEditingBannerId(null);
    setAlt('');
    setSrc('');
    setSelectedPageHref('');
    setImageFile(null);
    setPublishFrom('');
    setPublishTo('');
    setIsActive(true);
    setFormError('');
  }

  function openCreateModal() {
    resetForm();
    setIsModalOpen(true);
  }

  function openEditModal(banner: HomeBanner) {
    setEditingBannerId(banner.id);
    setImageSourceMode('path');
    setAlt(banner.alt);
    setSrc(banner.src);
    setSelectedPageHref(banner.href ?? '');
    setImageFile(null);
    setPublishFrom(banner.publishFrom ?? '');
    setPublishTo(banner.publishTo ?? '');
    setIsActive(banner.isActive);
    setFormError('');
    setIsModalOpen(true);
  }

  function formatDateLabel(value?: string) {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('uk-UA');
  }

  async function moveBanner(bannerId: string, direction: 'up' | 'down') {
    if (isSyncing) return;

    const currentIndex = banners.findIndex((banner) => banner.id === bannerId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const previous = [...banners];
    const next = [...banners];
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];

    setBanners(next);
    setIsSyncing(true);
    try {
      const saved = await saveBanners(next);
      setBanners(saved);
    } catch (error) {
      setBanners(previous);
      const message = error instanceof Error ? error.message : 'Не вдалося оновити порядок банерів.';
      setFormError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  async function deleteBanner(bannerId: string) {
    if (isSyncing) return;

    const banner = banners.find((item) => item.id === bannerId);
    if (!banner) return;

    const confirmed = window.confirm(`Видалити банер "${banner.alt}"?`);
    if (!confirmed) return;

    const previous = [...banners];
    const next = banners.filter((item) => item.id !== bannerId);

    setBanners(next);
    setIsSyncing(true);
    setFormError('');
    try {
      const saved = await saveBanners(next);
      setBanners(saved);
    } catch (error) {
      setBanners(previous);
      const message = error instanceof Error ? error.message : 'Не вдалося видалити банер.';
      setFormError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const normalizedAlt = alt.trim();
    const normalizedSrc = normalizeImagePathInput(src);
    let finalSrc = '';

    if (!normalizedAlt) {
      setFormError('Заповніть ALT текст банера.');
      return;
    }

    if (publishFrom && publishTo) {
      const fromMs = new Date(publishFrom).getTime();
      const toMs = new Date(publishTo).getTime();
      if (!Number.isNaN(fromMs) && !Number.isNaN(toMs) && toMs < fromMs) {
        setFormError('Дата завершення публікації не може бути раніше дати початку.');
        return;
      }
    }

    if (imageSourceMode === 'path') {
      if (!normalizedSrc || !isValidImagePath(normalizedSrc)) {
        setFormError('Вкажіть коректний шлях до зображення (/img/..., /media/..., public/img/... або https://...).');
        return;
      }
      finalSrc = normalizedSrc;
    } else {
      if (imageFile) {
        try {
          finalSrc = await uploadBannerImage(imageFile);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Не вдалося завантажити файл зображення.';
          setFormError(message);
          return;
        }
      } else if (isEditing) {
        const existing = banners.find((banner) => banner.id === editingBannerId);
        if (!existing?.src || existing.src.startsWith('data:image/')) {
          setFormError('Оберіть файл зображення для завантаження.');
          return;
        }
        finalSrc = existing.src;
      } else {
        setFormError('Оберіть файл зображення для завантаження.');
        return;
      }
    }

    let next: HomeBanner[] = [];

    if (isEditing) {
      next = banners.map((banner) =>
        banner.id === editingBannerId
          ? {
              ...banner,
              alt: normalizedAlt,
              src: finalSrc,
              href: selectedPageHref || undefined,
              isActive,
              publishFrom: publishFrom || undefined,
              publishTo: publishTo || undefined
            }
          : banner
      );
    } else {
      next = [
        ...banners,
        {
          id: `banner_${Date.now()}`,
          alt: normalizedAlt,
          src: finalSrc,
          href: selectedPageHref || undefined,
          isActive,
          publishFrom: publishFrom || undefined,
          publishTo: publishTo || undefined
        }
      ];
    }

    setIsSyncing(true);
    try {
      const saved = await saveBanners(next);
      setBanners(saved);
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не вдалося зберегти банери.';
      setFormError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Банери</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Керування банерами</h1>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={isLoading || isSyncing}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Додати новий банер
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-700 sm:text-base">Нижче відображаються всі наявні банери для головної сторінки.</p>
      {isLoading ? <p className="mt-2 text-sm font-semibold text-slate-600">Завантаження банерів з БД...</p> : null}

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="banner-search" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
            Пошук за назвою
          </label>
          <input
            id="banner-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Введіть назву банера..."
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <div>
          <label htmlFor="banner-filter-activity" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
            Активність
          </label>
          <div className="relative mt-1">
            <select
              id="banner-filter-activity"
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value as 'all' | 'active' | 'inactive')}
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 pr-8 text-sm font-medium outline-none transition focus:border-brand"
            >
              <option value="all">Усі</option>
              <option value="active">Активні</option>
              <option value="inactive">Неактивні</option>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">▼</span>
          </div>
        </div>

        <div>
          <label htmlFor="banner-filter-period" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
            Період публікації
          </label>
          <div className="relative mt-1">
            <select
              id="banner-filter-period"
              value={periodFilter}
              onChange={(event) =>
                setPeriodFilter(event.target.value as 'all' | 'scheduled' | 'live' | 'expired' | 'no_period')
              }
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 pr-8 text-sm font-medium outline-none transition focus:border-brand"
            >
              <option value="all">Усі</option>
              <option value="live">Публікується зараз</option>
              <option value="scheduled">Заплановано</option>
              <option value="expired">Завершено</option>
              <option value="no_period">Без періоду</option>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">▼</span>
          </div>
        </div>

        <div>
          <label htmlFor="banner-filter-date" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
            Пошук за датою
          </label>
          <input
            id="banner-filter-date"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none transition focus:border-brand"
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600">Знайдено банерів: {filteredBanners.length}</p>
        <button
          type="button"
          onClick={resetFilters}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
        >
          Скинути фільтри
        </button>
      </div>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {filteredBanners.map((banner) => {
          const orderIndex = banners.findIndex((item) => item.id === banner.id);
          const canMoveUp = orderIndex > 0;
          const canMoveDown = orderIndex >= 0 && orderIndex < banners.length - 1;
          const useNativeImage = shouldUseNativeImage(banner.src);

          return (
          <li key={banner.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {banner.src.startsWith('data:') ? (
              <div className="flex h-44 w-full items-center justify-center bg-slate-50 p-2">
                <img src={banner.src} alt={banner.alt} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="relative h-44 w-full bg-slate-50">
                {useNativeImage ? (
                  <img src={banner.src} alt={banner.alt} className="h-full w-full object-contain" loading="lazy" />
                ) : (
                  <Image src={banner.src} alt={banner.alt} fill className="object-contain" />
                )}
              </div>
            )}
            <div className="space-y-1 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Позиція:</span> {orderIndex >= 0 ? orderIndex + 1 : '—'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">ALT:</span> {banner.alt}
              </p>
              <p className="break-all">
                <span className="font-semibold text-slate-900">SRC:</span> {banner.src}
              </p>
              <p className="break-all">
                <span className="font-semibold text-slate-900">LINK:</span> {banner.href ?? '—'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Статус:</span> {banner.isActive ? 'Активний' : 'Неактивний'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Публікація з:</span> {formatDateLabel(banner.publishFrom)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Публікація до:</span> {formatDateLabel(banner.publishTo)}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => openEditModal(banner)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                >
                  Редагувати
                </button>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => void deleteBanner(banner.id)}
                  className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition enabled:hover:border-red-500 enabled:hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Видалити
                </button>
                <button
                  type="button"
                  disabled={!canMoveUp || isSyncing}
                  onClick={() => void moveBanner(banner.id, 'up')}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition enabled:hover:border-brand enabled:hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Вгору
                </button>
                <button
                  type="button"
                  disabled={!canMoveDown || isSyncing}
                  onClick={() => void moveBanner(banner.id, 'down')}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition enabled:hover:border-brand enabled:hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Вниз
                </button>
              </div>
            </div>
          </li>
          );
        })}
      </ul>

      {filteredBanners.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          За поточними фільтрами банери не знайдені.
        </p>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-[220] bg-slate-900/45 p-4" onClick={() => setIsModalOpen(false)}>
          <div
            className="mx-auto mt-6 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:mt-10 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-slate-900">{isEditing ? 'Редагувати банер' : 'Додати новий банер'}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Для локального файлу використовуйте шлях на кшталт <span className="font-semibold">/img/baners/file.jpg</span>.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="banner-alt" className="block text-sm font-semibold text-slate-900">
                  ALT текст
                </label>
                <input
                  id="banner-alt"
                  required
                  value={alt}
                  onChange={(event) => setAlt(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
                  placeholder="Наприклад: Головний банер Milka"
                />
              </div>

              <div>
                <p className="block text-sm font-semibold text-slate-900">Джерело зображення</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setImageSourceMode('path')}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      imageSourceMode === 'path'
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-slate-300 text-slate-700 hover:border-brand hover:text-brand'
                    }`}
                  >
                    Шлях/URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSourceMode('upload')}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      imageSourceMode === 'upload'
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-slate-300 text-slate-700 hover:border-brand hover:text-brand'
                    }`}
                  >
                    Завантажити файл
                  </button>
                </div>
              </div>

              {imageSourceMode === 'path' ? (
                <div>
                  <label htmlFor="banner-src" className="block text-sm font-semibold text-slate-900">
                    Шлях до зображення
                  </label>
                  <input
                    id="banner-src"
                    required
                    value={src}
                    onChange={(event) => setSrc(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
                    placeholder="/img/baners/banner.jpg"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="banner-file" className="block text-sm font-semibold text-slate-900">
                    Файл зображення
                  </label>
                  <input
                    id="banner-file"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                    className="mt-1.5 block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-semibold file:text-brand hover:file:bg-brand/20"
                  />
                </div>
              )}

              <div>
                <label htmlFor="banner-page" className="block text-sm font-semibold text-slate-900">
                  Сторінка для переходу
                </label>
                <select
                  id="banner-page"
                  value={selectedPageHref}
                  onChange={(event) => setSelectedPageHref(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
                >
                  <option value="">Без посилання</option>
                  {linkOptions.map((option) => (
                    <option key={option.href} value={option.href}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Активний банер
              </label>

              <div>
                <label htmlFor="banner-publish-from" className="block text-sm font-semibold text-slate-900">
                  Публікація з (дата і час)
                </label>
                <input
                  id="banner-publish-from"
                  type="datetime-local"
                  value={publishFrom}
                  onChange={(event) => setPublishFrom(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="banner-publish-to" className="block text-sm font-semibold text-slate-900">
                  Публікація до (дата і час)
                </label>
                <input
                  id="banner-publish-to"
                  type="datetime-local"
                  value={publishTo}
                  onChange={(event) => setPublishTo(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
                />
              </div>

              {formError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {formError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEditing ? 'Зберегти зміни' : 'Додати'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

