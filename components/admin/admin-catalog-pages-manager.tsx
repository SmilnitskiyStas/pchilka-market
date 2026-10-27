'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { catalogPageHref, type PromotionCatalogPage } from '@/lib/promotion-catalog-page-types';

type Props = { pages: PromotionCatalogPage[]; onChange: (pages: PromotionCatalogPage[]) => void; disabled?: boolean };
const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal';

export default function AdminCatalogPagesManager({ pages, onChange, disabled }: Props) {
  const [editing, setEditing] = useState<PromotionCatalogPage | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [showInList, setShowInList] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const reset = () => { setEditing(null); setTitle(''); setSlug(''); setDescription(''); setShowInList(true); };

  async function request(method: string, body: object) {
    setBusy(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/promotion-catalogs/pages', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json() as { ok?: boolean; pages?: PromotionCatalogPage[]; error?: string };
      if (!response.ok || !payload.ok || !payload.pages) throw new Error(payload.error || 'Не вдалося зберегти сторінки.');
      onChange(payload.pages);
      reset();
      setSuccess(method === 'DELETE' ? 'Сторінку видалено.' : 'Сторінку збережено.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося зберегти сторінку.'); }
    finally { setBusy(false); }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    void request(editing ? 'PUT' : 'POST', { id: editing?.id, title, slug, description, showInList, showArchive: pages.find((page) => page.id === editing?.id)?.showArchive ?? false });
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-lg font-semibold text-slate-900">Сторінки каталогів</h3>
      <p className="mt-2 text-sm text-slate-600">Кожна сторінка має власне посилання й окремий набір PDF-каталогів. Наявні PDF без призначення належать до Ф1.</p>
      <ul className="mt-4 space-y-3">
        {pages.map((page) => <li key={page.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="min-w-0"><p className="font-semibold">{page.title} · {page.showInList ? 'Видима' : 'Лише за посиланням'}</p><Link href={catalogPageHref(page)} target="_blank" className="break-all text-sm text-brand underline">{catalogPageHref(page)}</Link><p className="mt-1 text-sm text-slate-600">{page.description}</p></div>
          <div className="flex gap-2"><button type="button" disabled={busy || disabled} className="rounded-full border border-slate-300 px-3 py-1 text-sm disabled:opacity-60" onClick={() => { setEditing(page); setTitle(page.title); setSlug(page.slug); setDescription(page.description); setShowInList(page.showInList); setError(''); setSuccess(''); }}>Редагувати</button><button type="button" disabled={busy || disabled} className="rounded-full border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-60" onClick={() => {
            if (window.confirm(`Видалити сторінку «${page.title}»? Її посилання перестане працювати. Сторінку з PDF-каталогами спершу потрібно звільнити.`)) void request('DELETE', { id: page.id });
          }}>Видалити сторінку</button></div>
        </li>)}
      </ul>
      <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        <h4 className="font-semibold sm:col-span-2">{editing ? 'Редагувати сторінку' : 'Створити сторінку каталогу'}</h4>
        <label className="text-sm font-semibold">Назва сторінки<input required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Каталог Ф3" className={inputClass} /></label>
        <label className="text-sm font-semibold">Посилання: /promotions/catalog/<input required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="f3" className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Латинські літери, цифри та дефіси. Зміна адреси змінює публічне посилання.</span></label>
        <label className="text-sm font-semibold sm:col-span-2">Призначення сторінки<textarea maxLength={1000} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Які пропозиції або вид каталогу тут розміщуються" className={inputClass} /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={showInList} onChange={(e) => setShowInList(e.target.checked)} />Показувати у списку каталогів і карті сайту</label>
        <p className="text-xs text-slate-500 sm:col-span-2">Прихована зі списку сторінка залишається доступною за посиланням. Приховування зі списку не обмежує доступ до PDF-файлу.</p>
        <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={busy || disabled} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Збереження...' : editing ? 'Зберегти сторінку' : 'Створити сторінку'}</button>{editing ? <button type="button" onClick={reset} disabled={busy} className="rounded-full border border-slate-300 px-4 py-2 text-sm">Скасувати</button> : null}</div>
      </form>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p role="status" className="mt-3 text-sm text-emerald-700">{success}</p> : null}
    </section>
  );
}
