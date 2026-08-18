'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';

type Catalog = {
  id: string;
  name: string;
  url: string;
  updatedAt: string;
  pageCount: number;
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

  useEffect(() => {
    void requestCatalogs()
      .then(setCatalogs)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити каталоги.'))
      .finally(() => setIsLoading(false));
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
      const response = await fetch('/api/admin/promotion-catalogs', { method: 'POST', body: formData });
      const payload = (await response.json()) as { ok?: boolean; catalogs?: Catalog[]; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося завантажити каталог.');
      setCatalogs(payload.catalogs ?? []);
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

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Каталог акцій</h2>
      <p className="mt-2 text-sm text-slate-600">Завантажте PDF. Найновіший каталог автоматично буде основним на сторінці каталогу, інші залишаться в архіві.</p>

      <label className="mt-4 inline-flex cursor-pointer rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
        {isSaving ? 'Обробка...' : 'Додати PDF-каталог'}
        <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={isSaving} onChange={(event) => { void uploadCatalog(event); }} />
      </label>
      <Link href="/promotions/catalog" target="_blank" rel="noreferrer" className="ml-3 text-sm font-semibold text-brand underline underline-offset-2">
        Переглянути сторінку каталогу
      </Link>

      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
      {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}
      {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження каталогів...</p> : null}

      {!isLoading && catalogs.length === 0 ? <p className="mt-4 text-sm text-slate-600">Доданих через адмінку каталогів ще немає.</p> : null}
      <ul className="mt-4 space-y-3">
        {catalogs.map((catalog, index) => (
          <li key={catalog.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div>
              <p className="font-semibold text-slate-900">{catalog.name}{index === 0 ? ' · основний' : ''}</p>
              <p className="mt-1 text-xs text-slate-600">Оновлено: {new Date(catalog.updatedAt).toLocaleString('uk-UA')} · Сторінок: {catalog.pageCount}</p>
            </div>
            <div className="flex gap-2">
              <a href={catalog.url} target="_blank" rel="noreferrer" className="rounded-full border border-brand/30 px-3 py-1 text-xs font-semibold text-brand">Відкрити PDF</a>
              <button type="button" disabled={isSaving} onClick={() => { void deleteCatalog(catalog); }} className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 disabled:opacity-60">Видалити</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
