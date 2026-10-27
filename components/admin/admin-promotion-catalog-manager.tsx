'use client';

import Link from 'next/link';
import AdminCatalogPagesManager from '@/components/admin/admin-catalog-pages-manager';
import { catalogPageHref, DEFAULT_CATALOG_PAGE_ID, type PromotionCatalogPage } from '@/lib/promotion-catalog-page-types';
import { ChangeEvent, useEffect, useState } from 'react';

type Catalog = {
  pageId?: string;
  id: string;
  name: string;
  url: string;
  updatedAt: string;
  pageCount: number;
  title?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
};

type MediaAsset = {
  url: string;
};

type CatalogSettings = {
  showArchive: boolean;
};

async function requestCatalogs(): Promise<{ catalogs: Catalog[]; settings: CatalogSettings; pages: PromotionCatalogPage[] }> {
  const response = await fetch('/api/admin/promotion-catalogs', { cache: 'no-store' });
  const payload = (await response.json()) as { ok?: boolean; catalogs?: Catalog[]; settings?: CatalogSettings; pages?: PromotionCatalogPage[]; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося завантажити каталоги.');
  return { catalogs: payload.catalogs ?? [], settings: payload.settings ?? { showArchive: false }, pages: payload.pages ?? [] };
}

export default function AdminPromotionCatalogManager() {
  const [pages, setPages] = useState<PromotionCatalogPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState(DEFAULT_CATALOG_PAGE_ID);
  const [catalogPageId, setCatalogPageId] = useState(DEFAULT_CATALOG_PAGE_ID);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mediaPdfFiles, setMediaPdfFiles] = useState<MediaAsset[]>([]);
  const [selectedMediaPath, setSelectedMediaPath] = useState('');
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [settings, setSettings] = useState<CatalogSettings>({ showArchive: false });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    void requestCatalogs()
      .then((payload) => {
        setCatalogs(payload.catalogs);
        updatePages(payload.pages);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити каталоги.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    void fetch('/api/admin/assets', { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as { ok?: boolean; assets?: MediaAsset[] };
        if (!response.ok || !payload.ok) throw new Error();
        const pdfFiles = (payload.assets ?? []).filter((asset) => asset.url.toLowerCase().endsWith('.pdf'));
        setMediaPdfFiles(pdfFiles);
        setSelectedMediaPath(pdfFiles[0]?.url ?? '');
      })
      .catch(() => setError('Не вдалося завантажити PDF із медіафайлів.'));
  }, []);

  const selectedPage = pages.find((page) => page.id === selectedPageId);
  const visibleCatalogs = catalogs.filter((catalog) => (catalog.pageId || DEFAULT_CATALOG_PAGE_ID) === selectedPageId);

  function updatePages(next: PromotionCatalogPage[]) {
    setPages(next);
    setSelectedPageId((current) => next.some((page) => page.id === current) ? current : next[0]?.id ?? '');
  }

  useEffect(() => {
    setSettings({ showArchive: selectedPage?.showArchive ?? false });
  }, [selectedPage]);

  useEffect(() => {
    resetMetadataForm();
    setCatalogPageId(selectedPageId);
  }, [selectedPageId]);

  async function uploadCatalog(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Можна завантажити лише PDF-файл.');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      appendMetadata(formData);
      const response = await fetch('/api/admin/promotion-catalogs', { method: 'POST', body: formData });
      const payload = (await response.json()) as { ok?: boolean; catalogs?: Catalog[]; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося завантажити каталог.');
      setCatalogs(payload.catalogs ?? []);
      resetMetadataForm();
      setSuccess('Новий каталог додано. Він відображатиметься першим на публічній сторінці.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Не вдалося завантажити каталог.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCatalog(catalog: Catalog) {
    if (!window.confirm(`Видалити каталог «${catalog.name}»?`)) return;
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/promotion-catalogs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: catalog.id })
      });
      const payload = (await response.json()) as { ok?: boolean; catalogs?: Catalog[]; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося видалити каталог.');
      setCatalogs(payload.catalogs ?? []);
      setSuccess('Каталог видалено.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не вдалося видалити каталог.');
    } finally {
      setIsSaving(false);
    }
  }

  async function addMediaCatalog() {
    if (!selectedMediaPath) return;
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('sourcePath', selectedMediaPath);
      appendMetadata(formData);
      const response = await fetch('/api/admin/promotion-catalogs', { method: 'POST', body: formData });
      const payload = (await response.json()) as { ok?: boolean; catalogs?: Catalog[]; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося додати каталог.');
      setCatalogs(payload.catalogs ?? []);
      resetMetadataForm();
      setSuccess('Файл із медіафайлів додано до каталогу.');
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Не вдалося додати каталог.');
    } finally {
      setIsSaving(false);
    }
  }

  function appendMetadata(formData: FormData) {
    formData.append('pageId', selectedPageId);
    formData.append('title', title);
    formData.append('seoTitle', seoTitle);
    formData.append('seoDescription', seoDescription);
    formData.append('seoKeywords', seoKeywords);
  }

  function resetMetadataForm() {
    setEditingCatalogId(null);
    setTitle('');
    setSeoTitle('');
    setSeoDescription('');
    setSeoKeywords('');
  }

  function startEditingMetadata(catalog: Catalog) {
    setEditingCatalogId(catalog.id);
    setCatalogPageId(catalog.pageId || DEFAULT_CATALOG_PAGE_ID);
    setTitle(catalog.title ?? '');
    setSeoTitle(catalog.seoTitle ?? '');
    setSeoDescription(catalog.seoDescription ?? '');
    setSeoKeywords(catalog.seoKeywords ?? '');
    setError('');
    setSuccess('');
  }

  async function saveMetadata() {
    if (!editingCatalogId) return;
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/promotion-catalogs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCatalogId, metadata: { title, seoTitle, seoDescription, seoKeywords, pageId: catalogPageId } })
      });
      const payload = (await response.json()) as { ok?: boolean; catalogs?: Catalog[]; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося зберегти дані каталогу.');
      setCatalogs(payload.catalogs ?? []);
      resetMetadataForm();
      setSuccess('Дані каталогу та призначення сторінки збережено.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти дані каталогу.');
    } finally {
      setIsSaving(false);
    }
  }

  async function updateArchiveVisibility(showArchive: boolean) {
    setIsSavingSettings(true);
    setError('');
    try {
      const response = await fetch('/api/admin/promotion-catalogs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: selectedPageId, settings: { showArchive } })
      });
      const payload = (await response.json()) as { ok?: boolean; settings?: CatalogSettings; pages?: PromotionCatalogPage[]; error?: string };
      if (!response.ok || !payload.ok || !payload.settings) throw new Error(payload.error || 'Не вдалося зберегти налаштування архіву.');
      setSettings(payload.settings);
      if (payload.pages) updatePages(payload.pages);
      setSuccess('Налаштування відображення архіву збережено.');
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : 'Не вдалося зберегти налаштування архіву.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Каталоги акцій</h2>
      <AdminCatalogPagesManager pages={pages} onChange={updatePages} disabled={isLoading || isSaving || isSavingSettings} />
      <label className="mt-5 block text-sm font-semibold text-slate-900">Сторінка для PDF-каталогів
        <select value={selectedPageId} disabled={isLoading || isSaving || isSavingSettings} onChange={(event) => setSelectedPageId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3">
          {pages.length === 0 ? <option value="">Спочатку створіть сторінку</option> : pages.map((page) => <option key={page.id} value={page.id}>{page.title} — {catalogPageHref(page)}</option>)}
        </select>
      </label>
      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
      {selectedPage ? <>
      <p className="mt-2 text-sm text-slate-600">Додайте PDF із комп’ютера або оберіть файл із «Медіафайлів». Найновіший PDF буде основним лише на обраній сторінці, інші залишаться в її архіві. Каталоги різних сторінок не змішуються.</p>

      <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-900">
        <input type="checkbox" checked={settings.showArchive} disabled={isSavingSettings} onChange={(event) => { void updateArchiveVisibility(event.target.checked); }} className="h-4 w-4 rounded border-slate-300 text-brand" />
        Показувати архів каталогів на публічній сторінці
      </label>

      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-900">Назва каталогу
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Наприклад, Акції 1–14 серпня" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal" />
        </label>
        <label className="text-sm font-semibold text-slate-900">SEO title
          <input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder="Каталог акцій Pchilka Market" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal" />
        </label>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-900">SEO description
          <textarea value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal" />
        </label>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-900">SEO ключові слова
          <input value={seoKeywords} onChange={(event) => setSeoKeywords(event.target.value)} placeholder="акції, каталог, знижки" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal" />
        </label>
        {editingCatalogId ? <label className="text-sm font-semibold sm:col-span-2">Призначити каталог іншій сторінці<select value={catalogPageId} onChange={(e) => setCatalogPageId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5">{pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}</select></label> : null}
        {editingCatalogId ? <div className="sm:col-span-2 flex gap-2"><button type="button" disabled={isSaving} onClick={() => { void saveMetadata(); }} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Зберегти каталог</button><button type="button" onClick={resetMetadataForm} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Скасувати</button></div> : null}
      </div>

      <label className="mt-4 inline-flex cursor-pointer rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
        {isSaving ? 'Обробка...' : 'Додати PDF-каталог'}
        <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={isSaving} onChange={(event) => { void uploadCatalog(event); }} />
      </label>
      <Link href={catalogPageHref(selectedPage)} target="_blank" rel="noreferrer" className="ml-3 text-sm font-semibold text-brand underline underline-offset-2">
        Переглянути сторінку каталогу
      </Link>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex sm:items-end sm:gap-3">
        <label className="block flex-1 text-sm font-semibold text-slate-900">
          Обрати PDF із «Медіафайлів»
          <select value={selectedMediaPath} onChange={(event) => setSelectedMediaPath(event.target.value)} disabled={isSaving || mediaPdfFiles.length === 0} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal">
            {mediaPdfFiles.length === 0 ? <option value="">PDF-файлів немає</option> : mediaPdfFiles.map((asset) => <option key={asset.url} value={asset.url}>{asset.url.split('/').at(-1)}</option>)}
          </select>
        </label>
        <button type="button" disabled={isSaving || !selectedMediaPath} onClick={() => { void addMediaCatalog(); }} className="mt-3 rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-60 sm:mt-0">
          Додати обраний файл
        </button>
      </div>

      {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}
      {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження каталогів...</p> : null}

      {!isLoading && visibleCatalogs.length === 0 ? <p className="mt-4 text-sm text-slate-600">Доданих через адмінку каталогів ще немає.</p> : null}
      <ul className="mt-4 space-y-3">
        {visibleCatalogs.map((catalog, index) => (
          <li key={catalog.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div>
              <p className="font-semibold text-slate-900">{catalog.title || catalog.name}{index === 0 ? ' · основний' : ''}</p>
              <p className="mt-1 text-xs text-slate-600">Оновлено: {new Date(catalog.updatedAt).toLocaleString('uk-UA')} · Сторінок: {catalog.pageCount}</p>
            </div>
            <div className="flex gap-2">
              <a href={catalog.url} target="_blank" rel="noreferrer" className="rounded-full border border-brand/30 px-3 py-1 text-xs font-semibold text-brand">Відкрити PDF</a>
              <button type="button" disabled={isSaving} onClick={() => startEditingMetadata(catalog)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60">Редагувати / перенести</button>
              <button type="button" disabled={isSaving} onClick={() => { void deleteCatalog(catalog); }} className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 disabled:opacity-60">Видалити</button>
            </div>
          </li>
        ))}
      </ul>
      </> : null}
    </section>
  );
}
