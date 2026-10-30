'use client';

import { useEffect, useState } from 'react';
import type { PizzaStoreOption } from '@/lib/pizza-store-selection';

type Payload = { ok?: boolean; stores?: PizzaStoreOption[]; storeIds?: string[]; legacyUnmatchedCount?: number; unavailableSelectedCount?: number; error?: string };

export default function OwnBrandPizzaStoresManager() {
  const [stores, setStores] = useState<PizzaStoreOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unmatched, setUnmatched] = useState(0);
  const [unavailable, setUnavailable] = useState(0);

  async function load() {
    setLoading(true); setLoaded(false); setError('');
    try {
      const response = await fetch('/api/admin/own-brand/pizza-stores', { cache: 'no-store' });
      const payload: Payload = await response.json();
      if (!response.ok || !payload.ok || !Array.isArray(payload.stores) || !Array.isArray(payload.storeIds)) throw new Error(payload.error || 'Не вдалося завантажити магазини.');
      setStores(payload.stores); setSelected(payload.storeIds);
      setLoaded(true);
      setUnmatched(payload.legacyUnmatchedCount || 0); setUnavailable(payload.unavailableSelectedCount || 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити магазини.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const search = query.trim().toLocaleLowerCase('uk');
  const visible = stores.filter((store) => `${store.city} ${store.name} ${store.addressLine} ${store.storeCode}`.toLocaleLowerCase('uk').includes(search));
  function change(ids: string[]) { setSelected(ids); setSuccess(''); }
  async function save() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/own-brand/pizza-stores', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storeIds: selected }) });
      const payload: Payload = await response.json();
      if (!response.ok || !payload.ok || !Array.isArray(payload.storeIds)) throw new Error(payload.error || 'Не вдалося зберегти магазини.');
      setSelected(payload.storeIds); setUnmatched(0); setUnavailable(0); setSuccess('Магазини збережено. Список на сторінці піци оновлено.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не вдалося зберегти магазини.'); }
    finally { setSaving(false); }
  }

  return <section aria-labelledby="pizza-stores-title" className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <h2 id="pizza-stores-title" className="text-xl font-bold text-slate-900">Магазини з піцою</h2>
    <p className="mt-2 text-sm text-slate-600">Позначте магазини, які потрібно показувати на сторінці «Піца та кав’ярня». У списку доступні активні магазини з довідника з указаними містом та адресою.</p>
    {loading ? <p className="mt-3 text-sm text-slate-600">Завантаження магазинів...</p> : <>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-semibold text-slate-800">Знайти магазин
          <input type="search" value={query} disabled={saving} onChange={(event) => setQuery(event.target.value)} placeholder="Місто, адреса, назва або код" className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal" />
        </label>
        <p className="py-2 text-sm font-semibold text-slate-700">Обрано: {selected.length} із {stores.length}</p>
      </div>
      {unmatched > 0 ? <p className="mt-3 text-sm text-amber-800">У поточному списку є адреси, яких не знайдено серед активних магазинів: {unmatched}. Перевірте вибір перед збереженням — на сайті залишаться лише позначені магазини.</p> : null}
      {unavailable > 0 ? <p className="mt-3 text-sm text-amber-800">Раніше обрані магазини, які зараз недоступні: {unavailable}. Вони не відображаються на сайті.</p> : null}
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button type="button" disabled={saving || !visible.length} onClick={() => change([...new Set([...selected, ...visible.map((store) => store.id)])])} className="font-semibold text-brand disabled:opacity-50">Обрати знайдені</button>
        <button type="button" disabled={saving || !selected.length} onClick={() => change([])} className="font-semibold text-slate-600 disabled:opacity-50">Зняти всі позначки</button>
      </div>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 p-2">
        {visible.map((store) => <label key={store.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${selected.includes(store.id) ? 'border-brand/40 bg-brand/5' : 'border-slate-100 bg-slate-50'}`}>
          <input type="checkbox" disabled={saving} checked={selected.includes(store.id)} onChange={(event) => change(event.target.checked ? [...selected, store.id] : selected.filter((id) => id !== store.id))} className="mt-1" />
          <span className="min-w-0 text-sm"><span className="block font-semibold text-slate-900">{store.name}{store.storeCode ? ` · ${store.storeCode}` : ''}</span><span className="block text-slate-600">{store.city}, {store.addressLine}</span></span>
        </label>)}
        {!visible.length ? <p className="p-3 text-sm text-slate-600">{stores.length ? 'За цим запитом магазинів не знайдено.' : 'Немає доступних магазинів із містом та адресою.'}</p> : null}
      </div>
      <p className="mt-2 text-xs text-slate-500">Якщо зняти всі позначки та зберегти, адреси магазинів на сторінці піци не показуватимуться.</p>
      <button type="button" disabled={saving || !loaded} onClick={() => void save()} className="mt-4 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Збереження...' : 'Зберегти магазини'}</button>
    </>}
    {error ? <div role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" disabled={loading || saving} onClick={() => void load()} className="font-semibold underline">Оновити список</button></div> : null}
    {success ? <p role="status" className="mt-3 text-sm text-emerald-700">{success}</p> : null}
  </section>;
}
