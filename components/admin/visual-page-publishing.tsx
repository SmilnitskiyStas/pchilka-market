'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { VisualPage, VisualPageRecord } from '@/lib/visual-pages';
import { visualPageHref } from '@/lib/visual-pages';
import VisualPageBody from '@/components/visual-page-body';

const input = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
const button = 'rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-50';
export default function VisualPagePublishing({ page, record, dirty, onChange, onManage }: {
  page: VisualPage; record: VisualPageRecord | null; dirty: boolean;
  onChange: (page: VisualPage) => void;
  onManage: (action: 'rename' | 'restore', value: string | number) => void;
}) {
  const [newSlug, setNewSlug] = useState('');
  const [version, setVersion] = useState('');
  const seo = page.seo ?? { title: '', image: '', noIndex: false };
  const snapshot = record?.history?.find((item) => String(item.revision) === version);
  return <>
    <details className="rounded-2xl border border-slate-200 p-3"><summary className="cursor-pointer font-semibold">SEO та поширення</summary><div className="mt-3 space-y-3">
      <label className="block text-sm">Заголовок у пошуку<input className={input} maxLength={200} value={seo.title} placeholder={page.title} onChange={(event) => onChange({ ...page, seo: { ...seo, title: event.target.value } })} /></label>
      <label className="block text-sm">Зображення для поширення<input className={input} value={seo.image} placeholder="/media/… або https://…" onChange={(event) => onChange({ ...page, seo: { ...seo, image: event.target.value } })} /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={seo.noIndex} onChange={(event) => onChange({ ...page, seo: { ...seo, noIndex: event.target.checked } })} />Не показувати в пошуку та sitemap</label>
      <p className="text-xs text-slate-500">Опис для пошуку задається вище. Ці налаштування набувають чинності після публікації змін.</p>
    </div></details>
    {record ? <>
      <details className="rounded-2xl border border-slate-200 p-3"><summary className="cursor-pointer font-semibold">Історія версій</summary><div className="mt-3 space-y-3">
        <p className="text-xs text-slate-600">Зберігаються останні 20 попередніх версій. Відновлення змінює тільки чернетку.</p>
        <label className="block text-sm">Версія<select className={input} value={version} onChange={(event) => setVersion(event.target.value)}><option value="">Оберіть версію</option>{[...(record.history ?? [])].reverse().map((item) => <option key={item.revision} value={item.revision}>Версія {item.revision} — {new Date(item.updatedAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' })}</option>)}</select></label>
        {snapshot ? <><div data-page-preview className="max-h-80 overflow-auto" onClick={(event) => { if (event.target instanceof Element && event.target.closest('a')) event.preventDefault(); }}><VisualPageBody page={snapshot.draft} editing /></div><button type="button" className={button} disabled={dirty} onClick={() => onManage('restore', snapshot.revision)}>Відновити в чернетку</button></> : null}
      </div></details>
      {record.draft.slug !== 'rental-intro' ? <details className="rounded-2xl border border-slate-200 p-3"><summary className="cursor-pointer font-semibold">Змінити адресу</summary><div className="mt-3 space-y-3">
        <label className="block text-sm">Нова адреса: /pages/<input className={input} value={newSlug} maxLength={100} placeholder="nova-adresa" onChange={(event) => setNewSlug(event.target.value)} /></label>
        <p className="text-xs text-slate-600">Старе посилання перенаправлятиме на нове. Вміст опублікованої версії збережеться.</p>
        <button type="button" className={button} disabled={dirty || !newSlug || newSlug === record.draft.slug} onClick={() => onManage('rename', newSlug)}>Змінити адресу з перенаправленням</button>
      </div></details> : null}
      {dirty ? <p className="text-xs text-amber-800">Спочатку збережіть поточну чернетку, щоб відновити версію або змінити адресу.</p> : null}
      {record.published ? <Link className="inline-block text-sm font-semibold text-brand underline" href={`/admin/menu?page=${encodeURIComponent(visualPageHref(record.published.slug))}`} target="_blank" rel="noreferrer">Додати сторінку до меню або змінити її розміщення</Link> : null}
    </> : null}
  </>;
}
