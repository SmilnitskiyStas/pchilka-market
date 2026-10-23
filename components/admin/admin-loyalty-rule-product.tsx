'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const FILTER_KEY = 'loyalty-rule-filter';
const n = (value: unknown) => Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 });

export default function Product({ productCode }: { productCode: string }) {
  const search = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const rule = search.get('rule') || '836';
  const from = search.get('from') || '2026-08-26';
  const to = search.get('to') || '';
  const store = search.get('store') || '';
  const backUrl = `/admin/marketing/loyalty-rule-analytics?${new URLSearchParams({ rule, from, to, store, restore: '1' })}`;

  useEffect(() => {
    void fetch(`/api/admin/marketing/loyalty-rule-analytics/product?rule=${rule}&product=${productCode}`)
      .then((response) => response.json())
      .then((json) => json.ok && setRows(json.stores));
  }, [productCode, rule]);

  return <section className="rounded-xl border bg-white p-4">
    <Link href={backUrl} onClick={() => window.sessionStorage.setItem(FILTER_KEY, JSON.stringify({ rule, from, to, store }))} className="text-sm font-semibold text-brand underline">← До загальної аналітики</Link>
    <h1 className="mt-2 text-xl font-bold">Правило {rule}: товар {productCode}</h1>
    <p className="mt-1 text-sm text-slate-500">Вся доступна історія без фільтрації за датою.</p>
    <table className="mt-4 w-full text-sm"><thead><tr>{['ТП', 'Магазин', 'Чеків', 'Од.', 'Знижка'].map((head) => <th className="px-3 py-2 text-left" key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((item) => <tr className="border-b" key={item.shopCode}><td className="px-3 py-1.5">{item.shopCode}</td><td className="px-3 py-1.5">{item.shopName || '—'}</td><td className="px-3 py-1.5">{n(item.orders)}</td><td className="px-3 py-1.5">{n(item.units)}</td><td className="px-3 py-1.5">{n(item.discountTotal)}</td></tr>)}</tbody></table>
  </section>;
}