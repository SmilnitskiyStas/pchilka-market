'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const FILTER_KEY = 'loyalty-rule-filter';
const RULE_OPTIONS = [{ value: '836', label: '836 — кулінарія' }, { value: '838', label: '838 — кава для співробітників' }];
const n = (value: unknown) => Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 });
type Filter = { rule: string; from: string; to: string; store?: string };

export default function Analytics() {
  const search = useSearchParams();
  const [rule, setRule] = useState(search.get('rule') || '836');
  const [from, setFrom] = useState(search.get('from') || '2026-08-26');
  const [to, setTo] = useState(search.get('to') || '');
  const [store, setStore] = useState(search.get('store') || '');
  const [stores, setStores] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const currentFilter = (): Filter => ({ rule, from, to, store });
  const saveFilter = (filter: Filter) => window.sessionStorage.setItem(FILTER_KEY, JSON.stringify(filter));
  const load = async (filter: Filter = currentFilter()) => {
    saveFilter(filter);
    const query = new URLSearchParams({ rule: filter.rule, from: filter.from });
    if (filter.to) query.set('to', filter.to);
    if (filter.store) query.set('store', filter.store);
    const response = await fetch(`/api/admin/marketing/loyalty-rule-analytics?${query}`);
    const json = await response.json();
    if (!response.ok) throw Error(json.error);
    if (!filter.store) setStores(json.data.stores);
    setData(json.data);
  };
  const loadStoreOptions = async (filter: Filter) => {
    const query = new URLSearchParams({ rule: filter.rule, from: filter.from });
    if (filter.to) query.set('to', filter.to);
    const response = await fetch(`/api/admin/marketing/loyalty-rule-analytics?${query}`);
    const json = await response.json();
    if (response.ok) setStores(json.data.stores);
  };

  useEffect(() => {
    const saved = window.sessionStorage.getItem(FILTER_KEY);
    const stored: Filter | null = saved ? JSON.parse(saved) : null;
    const filter: Filter = {
      rule: search.get('rule') || stored?.rule || '836',
      from: search.get('from') || stored?.from || '2026-08-26',
      to: search.get('to') ?? stored?.to ?? '',
      store: search.get('store') ?? stored?.store ?? ''
    };
    setRule(filter.rule); setFrom(filter.from); setTo(filter.to); setStore(filter.store || '');
    if (search.get('restore') === '1' || Boolean(search.get('from')) || Boolean(stored)) {
      void load(filter).catch((cause) => setError(cause.message));
      if (filter.store) void loadStoreOptions(filter);
    }
  }, []);

  const productUrl = (productCode: string) => {
    const filter = currentFilter(); saveFilter(filter);
    return `/admin/marketing/loyalty-rule-analytics/${productCode}?${new URLSearchParams({ rule, from, to, store })}`;
  };
  const exportQuery = new URLSearchParams({ rule, from });
  if (to) exportQuery.set('to', to); if (store) exportQuery.set('store', store);
  const selectedRuleLabel = RULE_OPTIONS.find((item) => item.value === rule)?.label.replace(/^\d+ — /, '') || 'аналітика';

  return <section className="rounded-xl border border-slate-200 bg-white p-4">
    <h1 className="text-xl font-bold">Правило {rule} — {selectedRuleLabel}</h1>
    <div className="mt-3 flex flex-wrap gap-2">
      <select value={rule} onChange={(event) => { setRule(event.target.value); setData(null); setError(''); }} className="h-8 min-w-56 rounded border px-2">
        {RULE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-8 rounded border px-2" />
      <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-8 rounded border px-2" />
      <select value={store} onChange={(event) => setStore(event.target.value)} className="h-8 min-w-52 rounded border px-2">
        <option value="">Усі магазини</option>
        {stores.map((item) => <option value={item.shopCode} key={item.shopCode}>ТП {item.shopCode} — {item.shopName || 'Без назви'}</option>)}
      </select>
      <button onClick={() => void load().catch((cause) => setError(cause.message))} className="rounded bg-brand px-3 text-white">Оновити</button>
      {data && <a href={`/api/admin/marketing/loyalty-rule-analytics/export?${exportQuery}`} className="rounded border border-brand px-3 py-1 text-sm font-semibold text-brand">Завантажити Excel</a>}
    </div>
    {!stores.length && <p className="mt-2 text-xs text-slate-500">Спершу натисніть «Оновити», щоб завантажити перелік магазинів.</p>}
    {error && <p className="mt-3 text-red-700">{error}</p>}
    {data && <>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['Чеків', data.summary.orders], ['Позицій', data.summary.lineCount], ['Одиниць', data.summary.units], ['Знижка', data.summary.discountTotal]].map(([label, value]) => <div className="rounded bg-slate-50 p-2" key={String(label)}><small>{label}</small><b className="block">{n(value)}</b></div>)}
      </div>
      <h2 className="mt-5 font-bold">Магазини</h2>
      <Grid heads={['ТП', 'Магазин', 'Чеків', 'Позицій', 'Знижка']} rows={data.stores.map((item: any) => [item.shopCode, item.shopName || '—', n(item.orders), n(item.lineCount), n(item.discountTotal)])} />
      <h2 className="mt-5 font-bold">Товари</h2>
      <Grid heads={['Код', 'Товар', 'Од.', 'Знижка']} rows={data.products.map((item: any) => [item.productCode, <a className="text-brand underline" href={productUrl(item.productCode)} key={item.productCode}>{item.productName || '—'}</a>, n(item.units), n(item.discountTotal)])} />
    </>}
  </section>;
}

function Grid({ heads, rows }: { heads: string[]; rows: any[][] }) {
  const totals = heads.map((_, index) => index === 0 ? 'Разом' : index === 1 ? '' : rows.reduce((sum, row) => sum + Number(String(row[index]).replace(/\s/g, '').replace(',', '.')), 0));
  return <table className="mt-2 w-full text-sm"><thead className="border-b-2 border-slate-300"><tr>{heads.map((head, index) => <th className={`px-3 py-2 text-left ${index > 1 ? 'text-right' : ''}`} key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-b border-slate-200" key={index}>{row.map((cell, cellIndex) => <td className={`px-3 py-1.5 ${cellIndex > 1 ? 'text-right tabular-nums' : ''}`} key={cellIndex}>{cell}</td>)}</tr>)}</tbody><tfoot className="border-t-2 border-slate-400 bg-slate-50 font-bold"><tr>{totals.map((value, index) => <td className={`px-3 py-2 ${index > 1 ? 'text-right tabular-nums' : ''}`} key={index}>{index > 1 ? n(value) : value}</td>)}</tr></tfoot></table>;
}