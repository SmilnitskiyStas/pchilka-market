'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { mediaCatalogPage, mediaPreviewUrl } from '@/lib/media-catalog';
import { useMediaCatalog } from '@/lib/use-media-catalog';

async function loadImages(signal: AbortSignal): Promise<string[]> {
  const response = await fetch('/api/admin/images', { cache: 'no-store', signal });
  const payload = (await response.json()) as { ok?: boolean; images?: string[]; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося завантажити каталог зображень.');
  }
  return (Array.isArray(payload.images) ? payload.images : [])
    .filter((url) => /\.(jpe?g|png|webp|gif|avif)$/i.test(url));
}

function imageFileName(url: string) {
  const name = url.split('/').pop() || url;
  try { return decodeURIComponent(name); } catch { return name; }
}

export default function OwnBrandImageCatalog({ onSelect, onClose }: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { items, isLoading, error, refresh } = useMediaCatalog(true, loadImages);
  const query = search.trim().toLocaleLowerCase('uk');
  const filtered = items.filter((url) => `${url} ${imageFileName(url)}`.toLocaleLowerCase('uk').includes(query));
  const catalog = mediaCatalogPage(filtered, page);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="pizza-image-catalog-title"
      onCancel={onClose}
      className="m-auto max-h-[90dvh] w-[min(64rem,95vw)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl backdrop:bg-slate-900/45 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="pizza-image-catalog-title" className="text-xl font-bold text-slate-900">Каталог зображень</h2>
        <button type="button" onClick={onClose} className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold">Закрити</button>
      </div>
      <p className="mt-2 text-sm text-slate-600">Оберіть зображення піци. Нові файли можна завантажити в розділі «Медіафайли».</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          autoFocus
          aria-label="Пошук зображень"
          placeholder="Пошук за назвою або папкою…"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button type="button" onClick={refresh} disabled={isLoading} className="rounded-full border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Оновити каталог</button>
      </div>
      {isLoading ? <p className="mt-4 text-sm text-slate-600" role="status">Завантаження зображень…</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error} Натисніть «Оновити каталог», щоб повторити.</p> : null}
      {!isLoading && !error ? (
        <>
          <p className="mt-4 text-sm text-slate-600">Знайдено зображень: {filtered.length}</p>
          {filtered.length === 0 ? <p className="mt-3 text-sm text-slate-600">Зображень не знайдено.</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {catalog.items.map((url) => (
              <button key={url} type="button" onClick={() => onSelect(url)} title={url} className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-left hover:border-brand focus-visible:outline-brand">
                <div className="relative h-32 bg-slate-50">
                  <Image src={mediaPreviewUrl(url)} alt={imageFileName(url)} fill sizes="(max-width: 640px) 45vw, 220px" quality={60} className="object-contain" />
                </div>
                <span className="mt-2 block truncate text-xs text-slate-700">{imageFileName(url)}</span>
              </button>
            ))}
          </div>
          {catalog.pages > 1 ? (
            <nav aria-label="Сторінки каталогу зображень" className="mt-4 flex items-center justify-between gap-3 text-sm">
              <button type="button" disabled={catalog.page === 1} onClick={() => setPage(catalog.page - 1)} className="rounded-full border px-3 py-2 disabled:opacity-40">Назад</button>
              <span>{catalog.page} / {catalog.pages}</span>
              <button type="button" disabled={catalog.page === catalog.pages} onClick={() => setPage(catalog.page + 1)} className="rounded-full border px-3 py-2 disabled:opacity-40">Далі</button>
            </nav>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}
