'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';

type Catalog = {
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

async function requestCatalogs(): Promise<Catalog[]> {
  const response = await fetch('/api/admin/promotion-catalogs', { cache: 'no-store' });
  const payload = (await response.json()) as { ok?: boolean; catalogs?: Catalog[]; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося завантажити каталоги.');
  return payload.catalogs ?? [];
}

export default function AdminPromotionCatalogManager() {
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

  useEffect(() => {
    void requestCatalogs()
      .then(setCatalogs)
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
        body: JSON.stringify({ id: editingCatalogId, metadata: { title, seoTitle, seoDescription, seoKeywords } })
      });
      const payload = (await response.json()) as { ok?: boolean; catalogs?: Catalog[]; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося зберегти дані каталогу.');
      setCatalogs(payload.catalogs ?? []);
      resetMetadataForm();
      setSuccess('Назву й SEO-дані каталогу збережено.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти дані каталогу.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Каталог акцій</h2>
      <p className="mt-2 text-sm text-slate-600">Додайте PDF із комп’ютера або оберіть файл із «Медіафайлів». Найновіший каталог автоматично буде основним на сторінці каталогу, інші залишаться в архіві.</p>

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
        {editingCatalogId ? <div className="sm:col-span-2 flex gap-2"><button type="button" disabled={isSaving} onClick={() => { void saveMetadata(); }} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Зберегти назву й SEO</button><button type="button" onClick={resetMetadataForm} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Скасувати</button></div> : null}
      </div>

      <label className="mt-4 inline-flex cursor-pointer rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
        {isSaving ? 'Обробка...' : 'Додати PDF-каталог'}
        <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={isSaving} onChange={(event) => { void uploadCatalog(event); }} />
      </label>
      <Link href="/promotions/catalog" target="_blank" rel="noreferrer" className="ml-3 text-sm font-semibold text-brand underline underline-offset-2">
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

      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
      {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}
      {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження каталогів...</p> : null}

      {!isLoading && catalogs.length === 0 ? <p className="mt-4 text-sm text-slate-600">Доданих через адмінку каталогів ще немає.</p> : null}
      <ul className="mt-4 space-y-3">
        {catalogs.map((catalog, index) => (
          <li key={catalog.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div>
              <p className="font-semibold text-slate-900">{catalog.title || catalog.name}{index === 0 ? ' · основний' : ''}</p>
              <p className="mt-1 text-xs text-slate-600">Оновлено: {new Date(catalog.updatedAt).toLocaleString('uk-UA')} · Сторінок: {catalog.pageCount}</p>
            </div>
            <div className="flex gap-2">
              <a href={catalog.url} target="_blank" rel="noreferrer" className="rounded-full border border-brand/30 px-3 py-1 text-xs font-semibold text-brand">Відкрити PDF</a>
              <button type="button" disabled={isSaving} onClick={() => startEditingMetadata(catalog)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60">Назва й SEO</button>
              <button type="button" disabled={isSaving} onClick={() => { void deleteCatalog(catalog); }} className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 disabled:opacity-60">Видалити</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
