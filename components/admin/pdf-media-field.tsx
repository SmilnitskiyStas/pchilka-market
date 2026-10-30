'use client';

import { useState } from 'react';
import { useMediaCatalog } from '@/lib/use-media-catalog';
import { mediaCatalogPage } from '@/lib/media-catalog';
import { isPdfDocumentUrl } from '@/lib/pdf-document';

async function loadPdfs(signal: AbortSignal): Promise<string[]> {
  const response = await fetch('/api/admin/assets', { cache: 'no-store', signal });
  const payload = await response.json();
  if (!response.ok || !payload.ok || !Array.isArray(payload.assets)) throw new Error('Не вдалося завантажити PDF-каталог.');
  return payload.assets.map((asset: { url: string }) => asset.url).filter(isPdfDocumentUrl);
}
export default function PdfMediaField({ value, onChange, onBusy }: { value: string; onChange: (src: string) => void; onBusy: (busy: boolean) => void }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const catalog = useMediaCatalog(open, loadPdfs);
  const filtered = catalog.items.filter(url => { try { return decodeURIComponent(url).toLocaleLowerCase('uk').includes(search.toLocaleLowerCase('uk')); } catch { return url.toLowerCase().includes(search.toLowerCase()); } });
  const pages = mediaCatalogPage(filtered, page);
  async function upload(file?: File) {
    if (!file || busy) return;
    if (!/\.pdf$/i.test(file.name) || file.size > 50 * 1024 * 1024) { setError('Оберіть PDF-файл до 50 МБ.'); return; }
    setBusy(true); onBusy(true); setError('');
    try {
      const data = new FormData(); data.append('file', file); data.append('folder', 'documents/pages');
      const response = await fetch('/api/admin/assets', { method: 'POST', body: data });
      const payload = await response.json();
      if (!response.ok || !payload.ok || !isPdfDocumentUrl(payload.path)) throw new Error(payload.error || 'Не вдалося завантажити PDF. Потрібен доступ до медіафайлів.');
      onChange(payload.path); setOpen(false); catalog.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Помилка завантаження PDF.'); }
    finally { setBusy(false); onBusy(false); }
  }
  return <div>
    <label className="block text-sm font-semibold">Посилання на PDF<input value={value} onChange={event => onChange(event.target.value)} placeholder="/media/…/document.pdf або https://…/document.pdf" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" /></label>
    <fieldset disabled={busy} className="mt-2 flex flex-wrap gap-2">
      <button type="button" onClick={() => { setOpen(!open); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm">{open ? 'Закрити PDF-каталог' : 'Обрати PDF з медіабібліотеки'}</button>
      <label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">Завантажити PDF<input type="file" accept=".pdf,application/pdf" aria-label="Завантажити PDF" className="sr-only" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label>
    </fieldset>
    {busy ? <p role="status" className="mt-2 text-sm">Завантаження PDF…</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    {open ? <section aria-label="PDF-каталог" className="mt-3 space-y-2 rounded-xl border border-slate-200 p-3">
      <input aria-label="Пошук PDF" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Пошук PDF за назвою" className="w-full rounded-lg border p-2 text-sm" />
      <button type="button" disabled={catalog.isLoading} onClick={() => { setPage(1); catalog.refresh(); }} className="rounded-lg border px-3 py-1 text-sm">Оновити PDF-каталог</button>
      {catalog.isLoading ? <p role="status" className="text-sm">Завантаження каталогу…</p> : null}
      {catalog.error ? <p role="alert" className="text-sm text-red-700">{catalog.error}</p> : null}
      {!catalog.isLoading && !catalog.error ? <><ul className="max-h-72 space-y-2 overflow-auto">{pages.items.map(url => <li key={url}><button type="button" onClick={() => { onChange(url); setOpen(false); }} className="w-full break-all rounded-lg border p-2 text-left text-sm">{url.split('/').pop()}<span className="block text-xs text-slate-500">{url}</span></button></li>)}</ul>{!filtered.length ? <p className="text-sm text-slate-600">PDF-файлів не знайдено.</p> : null}{pages.pages > 1 ? <nav aria-label="Сторінки PDF-каталогу" className="flex items-center justify-between gap-2 text-sm"><button type="button" disabled={pages.page === 1} onClick={() => setPage(pages.page - 1)}>Назад</button><span>{pages.page} / {pages.pages}</span><button type="button" disabled={pages.page === pages.pages} onClick={() => setPage(pages.page + 1)}>Далі</button></nav> : null}</> : null}
    </section> : null}
  </div>;
}
