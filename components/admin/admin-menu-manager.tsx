'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { defaultSiteMenu, moveMenuItem, type ManagedMenuItem, type SiteMenuSettings } from '@/lib/site-menu';
import { filterContentMenu } from '@/lib/menu-content';

const inputClass = 'mt-1 block w-full min-w-0 rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal';
type Destination = { label: string; href: string };
export default function AdminMenuManager({ initialHref = '' }: { initialHref?: string } = {}) {
  const [settings, setSettings] = useState<SiteMenuSettings>(() => structuredClone(defaultSiteMenu));
  const [saved, setSaved] = useState<SiteMenuSettings>(() => structuredClone(defaultSiteMenu));
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [contentAvailable, setContentAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [openPreview, setOpenPreview] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());
  const [destinationParent, setDestinationParent] = useState('');
  const requestedDestination = destinations.find((item) => item.href === initialHref);
  const destinationExists = !!requestedDestination && settings.items.some((item) => item.href === initialHref || item.children?.some((child) => child.href === initialHref));

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/menu', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося завантажити меню.');
      if (!controller.signal.aborted) {
        setSettings(payload.settings); setSaved(payload.settings); setDestinations(payload.destinations);
        setPaths(payload.populatedPaths); setContentAvailable(payload.contentAvailable);
      }
    }).catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Не вдалося завантажити меню.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  function update(items: ManagedMenuItem[]) { setSettings({ items }); setSuccess(''); setError(''); }
  function patch(id: string, value: Partial<ManagedMenuItem>) {
    update(settings.items.map((item) => item.id === id ? { ...item, ...value } : { ...item, children: item.children?.map((child) => child.id === id ? { ...child, ...value } : child) }));
  }
  function remove(id: string) {
    update(settings.items.filter((item) => item.id !== id).map((item) => ({ ...item, children: item.children?.filter((child) => child.id !== id) })));
  }
  function move(id: string, parentId: string | null, position: number) {
    try { update(moveMenuItem(settings.items, id, parentId, position)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося перемістити пункт.'); }
  }
  function add(parentId: string | null, destination?: Destination) {
    const item: ManagedMenuItem = { id: crypto.randomUUID(), label: destination?.label || 'Новий пункт', href: destination?.href || '/', visibility: 'auto' };
    if (parentId) patch(parentId, { children: [...(settings.items.find((row) => row.id === parentId)?.children ?? []), item] });
    else update([...settings.items, item]);
    setExpandedItems((current) => new Set([...current, item.id, ...(parentId ? [parentId] : [])]));
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/menu', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося зберегти меню.');
      setSettings(payload.settings); setSaved(payload.settings); setSuccess('Меню збережено. Оновіть сторінку сайту, щоб побачити зміни.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося зберегти меню.'); }
    finally { setSaving(false); }
  }
  const preview = filterContentMenu(settings.items, new Set(paths));
  const visibleIds = new Set(preview.flatMap((item) => [item.id, ...(item.children ?? []).map((child) => child.id)]));

  function row(item: ManagedMenuItem, parent: ManagedMenuItem | null, index: number, length: number) {
    const expanded = expandedItems.has(item.id);
    return <div key={item.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
      event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData('text/plain'); if (id && id !== item.id) move(id, parent?.id ?? null, index);
    }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2"><button type="button" draggable aria-label={`Перетягнути ${item.label}`} onDragStart={(event) => { event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; }} className="cursor-grab rounded-lg border px-2 py-1 text-lg">⠿</button><div><p className="text-xs font-semibold text-slate-500">{parent ? `Підменю «${parent.label}»` : 'Головний рядок'} · позиція {index + 1}</p><p className={`text-xs ${visibleIds.has(item.id) ? 'text-green-700' : 'text-amber-700'}`}>{visibleIds.has(item.id) ? 'Відображається на сайті' : 'Приховано на сайті'}</p></div></div>
        <button type="button" aria-expanded={expanded} aria-controls={`menu-settings-${item.id}`} onClick={() => setExpandedItems((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-2 py-2 text-left font-semibold text-slate-900">
          <span className="min-w-0 break-words">{item.label}{item.children?.length ? <span className="ml-2 text-xs font-normal text-slate-500">Підпунктів: {item.children.length}</span> : null}</span><span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={index === 0} aria-label={`Підняти ${item.label}`} onClick={() => move(item.id, parent?.id ?? null, index - 1)} className="rounded-full border px-3 py-1 disabled:opacity-40">↑</button>
          <button type="button" disabled={index === length - 1} aria-label={`Опустити ${item.label}`} onClick={() => move(item.id, parent?.id ?? null, index + 1)} className="rounded-full border px-3 py-1 disabled:opacity-40">↓</button>
        </div>
      </div>
      <div id={`menu-settings-${item.id}`} hidden={!expanded} className="mt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Назва пункту<input required maxLength={100} value={item.label} onChange={(event) => patch(item.id, { label: event.target.value })} className={inputClass} /></label>
        <label className="text-sm font-semibold">Де розмістити<select value={parent?.id ?? ''} onChange={(event) => { const id = event.target.value || null; move(item.id, id, id ? settings.items.find((entry) => entry.id === id)?.children?.length ?? 0 : settings.items.length); }} className={inputClass} disabled={!!item.children?.length}>
          <option value="">Головний рядок меню</option>{settings.items.filter((entry) => entry.id !== item.id).map((entry) => <option key={entry.id} value={entry.id}>Підменю: {entry.label}</option>)}
        </select>{item.children?.length ? <span className="mt-1 block text-xs font-normal text-slate-500">Пункт із підменю залишається в головному рядку.</span> : null}</label>
        <label className="text-sm font-semibold">Оберіть сторінку<select value={item.href === '#' || destinations.some((destination) => destination.href === item.href) ? item.href : ''} onChange={(event) => { if (event.target.value) patch(item.id, { href: event.target.value }); }} className={inputClass}>
          <option value="">Власне посилання або група</option><option value="#">Група підменю (без окремої сторінки)</option>{destinations.map((destination) => <option key={destination.href} value={destination.href}>{destination.label} — {destination.href}</option>)}
        </select></label>
        <label className="text-sm font-semibold">Посилання<input required maxLength={2000} value={item.href} onChange={(event) => patch(item.id, { href: event.target.value })} placeholder="/about/stores або https://..." className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Для групи підменю вкажіть #. Для переходу — адресу наявної сторінки.</span></label>
        <label className="text-sm font-semibold sm:col-span-2">Показувати на сайті<select value={item.visibility} onChange={(event) => patch(item.id, { visibility: event.target.value as ManagedMenuItem['visibility'] })} className={inputClass}>
          <option value="auto">Автоматично: приховувати порожні інформаційні сторінки</option><option value="always">Завжди показувати</option><option value="hidden">Приховати пункт і його підменю</option>
        </select></label>
      </div>
      {!parent ? <>
        <div className="mt-4 space-y-3 border-l-2 border-brand/30 pl-3 sm:pl-5">{item.children?.map((child, childIndex) => row(child, item, childIndex, item.children!.length))}</div>
        <button type="button" onClick={() => add(item.id)} className="mt-3 rounded-full border border-brand px-3 py-1.5 text-sm font-semibold text-brand">+ Додати підпункт до «{item.label}»</button>
      </> : null}
      <button type="button" onClick={() => remove(item.id)} className="mt-3 rounded-full border border-red-300 px-3 py-1 text-sm text-red-700">Видалити{item.children?.length ? ' разом із підменю' : ''}</button>
      </div>
    </div>;
  }

  return <div>
    <h1 className="text-2xl font-bold text-slate-900">Меню сайту</h1>
    <p className="mt-2 text-sm text-slate-600">Верхній рівень — головний рядок у шапці сайту. Вкладені пункти відкриваються в підменю. Перетягуйте пункти за значок ⠿, використовуйте стрілки або поле «Де розмістити».</p>
    <Link href="/" target="_blank" className="mt-3 inline-block text-sm font-semibold text-brand underline">Відкрити сайт ↗</Link>
    {loading ? <p role="status" className="mt-3 text-sm">Завантаження меню...</p> : null}
    {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    {success ? <p role="status" className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">{success}</p> : null}
    {requestedDestination ? <section className="mt-4 space-y-3 rounded-2xl border border-brand/30 bg-brand/5 p-4">
      <h2 className="font-semibold">Сторінка: {requestedDestination.label}</h2>
      <p className="text-sm">{requestedDestination.href}{destinationExists ? ' — посилання вже є в меню.' : ''}</p>
      <label className="block text-sm">Де додати<select className={inputClass} value={destinationParent} onChange={(event) => setDestinationParent(event.target.value)}><option value="">Головний рівень</option>{settings.items.map((item) => <option key={item.id} value={item.id}>Підменю: {item.label}</option>)}</select></label>
      <button type="button" disabled={loading || saving || destinationExists} className="rounded-xl border border-brand px-3 py-2 text-sm font-semibold text-brand disabled:opacity-50" onClick={() => add(destinationParent || null, requestedDestination)}>Додати пункт у чернетку меню</button>
      <p className="text-xs text-slate-600">Після перевірки розміщення натисніть «Зберегти меню» внизу сторінки.</p>
    </section> : null}
    <details className="my-5 rounded-2xl border border-brand/30 bg-slate-50 p-4">
      <summary className="cursor-pointer font-semibold">Попередній перегляд меню на сайті</summary>
      <section className="mt-4" aria-label="Попередній перегляд меню">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Попередній перегляд на сайті</h2><div className="flex gap-2">{(['desktop', 'mobile'] as const).map((mode) => <button type="button" key={mode} aria-pressed={previewMode === mode} onClick={() => setPreviewMode(mode)} className={`rounded-full border px-3 py-1 text-sm ${previewMode === mode ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300'}`}>{mode === 'desktop' ? 'Комп’ютер' : 'Телефон'}</button>)}</div></div>
      <p className="mt-2 text-xs text-slate-600">Показує незбережені зміни. Натисніть пункт із підменю, щоб переглянути вкладені посилання. Швидкі посилання у футері повторюють головний рівень.</p>
      {!contentAvailable ? <p className="mt-2 text-xs text-amber-800">Не вдалося перевірити статті. Автоматична видимість інформаційних сторінок може відрізнятися після відновлення доступу до контенту.</p> : null}
      <div className={`mt-4 rounded-xl border bg-white p-3 ${previewMode === 'mobile' ? 'mx-auto max-w-sm' : ''}`}>
        <p className="mb-3 font-bold text-brand">Пчілка маркет <span className="ml-2 text-xs font-normal text-slate-500">{previewMode === 'desktop' ? 'Головне меню' : 'Мобільне меню ☰'}</span></p>
        <div className={previewMode === 'desktop' ? 'flex flex-wrap gap-2' : 'space-y-2'}>{preview.map((item) => <div key={item.id} className={previewMode === 'desktop' ? 'min-w-0' : ''}>
          <button type="button" aria-expanded={item.children?.length ? openPreview === item.id : undefined} onClick={() => setOpenPreview(openPreview === item.id ? null : item.id!)} className="max-w-full break-words rounded-lg border px-3 py-2 text-left text-sm font-semibold">{item.label}{item.children?.length ? ' ▾' : ''}</button>
          {openPreview === item.id ? <div className="mt-2 rounded-lg border bg-slate-50 p-2 text-sm">{item.children?.length ? item.children.map((child) => <p key={child.id || child.href} className="mb-2 break-words">{child.label}<span className="block break-all text-xs text-slate-500">{child.href}</span></p>) : <p className="break-all text-xs text-slate-500">{item.href}</p>}</div> : null}
        </div>)}</div>
        {!preview.length ? <p className="text-sm text-slate-500">Меню порожнє: додайте пункт або змініть видимість.</p> : null}
      </div>
    </section>
    </details>
    <form onSubmit={save}><fieldset disabled={loading || saving} className="min-w-0 space-y-4">
      {settings.items.map((item, index) => row(item, null, index, settings.items.length))}
      <button type="button" onClick={() => add(null)} className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand">+ Додати пункт головного меню</button>
      <div className="sticky bottom-3 flex flex-wrap gap-3 rounded-2xl border bg-white p-3 shadow-lg"><button type="submit" className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white">{saving ? 'Збереження...' : 'Зберегти меню'}</button><button type="button" onClick={() => { setSettings(structuredClone(saved)); setError(''); setSuccess(''); }} className="rounded-full border px-4 py-2 text-sm">Скасувати зміни</button></div>
    </fieldset></form>
  </div>;
}
