'use client';

import { useEffect, useState } from 'react';

import type { RfmProductRelations, RfmReport, RfmSegmentBehavior, RfmSegmentCustomer, RfmSegmentDetail, RfmSegmentTopProduct } from '@/lib/marketing-rfm';

type Payload = { ok?: boolean; report?: RfmReport; detail?: RfmSegmentDetail; behavior?: RfmSegmentBehavior; customers?: RfmSegmentCustomer[]; products?: RfmSegmentTopProduct[]; relations?: RfmProductRelations; error?: string };
const number = (value: number) => value.toLocaleString('uk-UA');
const money = (value: number) => `${Math.round(value).toLocaleString('uk-UA')} ₴`;

export default function AdminMarketingRfmDashboard() {
  const [days, setDays] = useState(180);
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [report, setReport] = useState<RfmReport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RfmSegmentDetail | null>(null);
  const [behavior, setBehavior] = useState<RfmSegmentBehavior | null>(null);
  const [customers, setCustomers] = useState<RfmSegmentCustomer[] | null>(null);
  const [products, setProducts] = useState<RfmSegmentTopProduct[] | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [relatedProduct, setRelatedProduct] = useState<RfmSegmentTopProduct | null>(null);
  const [relations, setRelations] = useState<RfmProductRelations | null>(null);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [relationMode, setRelationMode] = useState<'affinity' | 'together'>('affinity');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/admin/marketing/stores').then((response) => response.json()).then((payload: { stores?: Array<{ id: string; name: string }> }) => setStores(payload.stores ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setSelected(null);
    void fetch(`/api/admin/marketing/rfm?days=${days}&storeId=${storeId}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() as Payload }))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.ok || !payload.report) throw new Error(payload.error ?? 'Не вдалося завантажити звіт.');
        setReport(payload.report);
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Не вдалося завантажити звіт.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [days, storeId]);

  useEffect(() => {
    if (!selected) { setDetail(null); setBehavior(null); setCustomers(null); setProducts(null); setRelatedProduct(null); setRelations(null); return; }
    const controller = new AbortController();
    setDetailLoading(true); setError(''); setBehavior(null); setCustomers(null); setProducts(null); setRelatedProduct(null); setRelations(null);
    void fetch(`/api/admin/marketing/rfm/${selected}?days=${days}&storeId=${storeId}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() as Payload }))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.ok || !payload.detail) throw new Error(payload.error ?? 'Не вдалося завантажити сегмент.');
        setDetail(payload.detail);
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Не вдалося завантажити сегмент.');
      })
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
  }, [days, selected, storeId]);

  async function loadCustomers() {
    if (!selected) return;
    setError('');
    try {
      const response = await fetch(`/api/admin/marketing/rfm/${selected}/customers?days=${days}&storeId=${storeId}`, { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok || !payload.ok || !payload.customers) throw new Error(payload.error ?? 'Не вдалося завантажити покупців.');
      setCustomers(payload.customers);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не вдалося завантажити покупців.'); }
  }

  async function loadBehavior() {
    if (!selected) return;
    try {
      const response = await fetch(`/api/admin/marketing/rfm/${selected}/behavior?days=${days}&storeId=${storeId}`, { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok || !payload.ok || !payload.behavior) throw new Error(payload.error ?? 'Не вдалося завантажити поведінку.');
      setBehavior(payload.behavior);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не вдалося завантажити поведінку.'); }
  }

  async function loadProducts() {
    if (!selected) return;
    setProductsLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/marketing/rfm/${selected}/products?days=${days}&storeId=${storeId}`, { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok || !payload.ok || !payload.products) throw new Error(payload.error ?? 'Не вдалося завантажити товари.');
      setProducts(payload.products); setRelatedProduct(null); setRelations(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не вдалося завантажити товари.'); }
    finally { setProductsLoading(false); }
  }

  async function loadRelatedProducts(product: RfmSegmentTopProduct) {
    if (!selected) return;
    setRelatedProduct(product); setRelations(null); setRelationsLoading(true); setRelationMode('affinity'); setError('');
    try {
      const response = await fetch(`/api/admin/marketing/rfm/${selected}/products/${product.code}/related?days=${days}&storeId=${storeId}`, { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok || !payload.ok || !payload.relations) throw new Error(payload.error ?? 'Не вдалося завантажити пов’язані товари.');
      setRelations(payload.relations);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не вдалося завантажити пов’язані товари.'); }
    finally { setRelationsLoading(false); }
  }

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Маркетинг · локальні дані</p><h1 className="mt-2 text-3xl font-bold text-slate-900">RFM-аналіз покупців</h1><p className="mt-2 text-sm text-slate-600">Сегментація за давністю, частотою та сумою покупок.</p></div>
      <div className="flex flex-wrap gap-2 text-sm font-medium text-slate-700">
        <label>Магазин <select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900"><option value="">Уся мережа</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
        <label>Період <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900"><option value={90}>90 днів</option><option value={180}>180 днів</option><option value={365}>Рік</option></select></label>
      </div>
    </div>
    {report ? <p className="mt-4 text-sm text-slate-500">Період: {report.period.from} — {report.period.to}.</p> : null}
    {loading ? <p className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Розраховую RFM-сегменти…</p> : null}
    {error ? <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
    {report ? <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Покупці за період', number(report.totals.customers)], ['Оборот за період', money(report.totals.turnover)], ['Зареєстрована база', number(report.totals.registeredCustomers)], ['Середній чек', money(report.totals.averageCheck)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>)}</div>
      <section className="mt-7"><h2 className="text-lg font-bold text-slate-900">RFM-сегменти</h2><p className="mt-1 text-sm text-slate-500">Натисніть картку, щоб побачити деталізацію.</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{report.segments.map((segment) => <button type="button" key={segment.id} onClick={() => setSelected(segment.id)} className={`rounded-2xl border p-4 text-left transition hover:border-brand ${selected === segment.id ? 'border-brand bg-brand/5' : 'border-slate-200 bg-white'}`}><p className="font-semibold text-brand">{segment.label}</p><p className="mt-1 text-xs text-slate-500">{segment.description}</p><p className="mt-4 text-2xl font-bold text-slate-900">{number(segment.customers)}</p><p className="mt-2 text-sm text-slate-600">{money(segment.turnover)} · {money(segment.averageCheck)} сер. чек</p></button>)}</div></section>
      {detailLoading ? <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Завантажую деталізацію…</p> : null}
      {detail ? <section className="mt-7 rounded-3xl border border-brand/25 bg-white p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Деталізація сегмента</p><h2 className="mt-1 text-2xl font-bold text-slate-900">{detail.segment.label}</h2><p className="mt-1 text-sm text-slate-600">{detail.segment.description}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">Закрити</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Чеки', number(detail.behavior.orders)], ['Чеків / покупця', detail.behavior.ordersPerCustomer.toFixed(1)], ['Сер. давність', `${Math.round(detail.behavior.averageRecencyDays)} дн.`], ['Сумарний оборот', money(detail.behavior.totalLifetimeValue)], ['Останній візит', detail.behavior.latestVisit ?? '—'], ['Пікова година', behavior?.busiestHour ?? '—'], ['Піковий день', behavior?.busiestWeekday ?? '—'], ['Сер. оборот', money(detail.behavior.averageLifetimeValue)]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>)}</div>
        <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => void loadProducts()} disabled={productsLoading} className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{productsLoading ? 'Завантажую товари…' : 'Завантажити топ товарів'}</button><button type="button" onClick={() => void loadCustomers()} className="rounded-xl border border-brand px-3 py-2 text-sm font-semibold text-brand">Показати покупців сегмента</button><button type="button" onClick={() => void loadBehavior()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Завантажити поведінку</button></div>
        {products ? <section className="mt-6 rounded-2xl border border-slate-200 p-4"><div><h3 className="text-lg font-bold text-slate-900">Топ товарів сегмента</h3><p className="mt-1 text-sm text-slate-500">За охопленням покупців сегмента · натисніть товар, щоб побачити зв’язки.</p></div>{products.length ? <ol className="mt-4 space-y-2">{products.map((product, index) => <li key={product.code}><button type="button" onClick={() => void loadRelatedProducts(product)} className={`grid w-full gap-2 rounded-xl p-2 text-left transition hover:bg-brand/5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] ${relatedProduct?.code === product.code ? 'bg-brand/10 ring-1 ring-brand/30' : ''}`}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">{index + 1}</span><div><p className="font-semibold text-slate-900">{product.name}</p><p className="mt-1 text-xs text-slate-500">Код: {product.code} · купували {number(product.customers)} покупців у {number(product.orders)} чеках · {number(product.units)} од.</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(product.reach, 100)}%` }} /></div></div><div className="text-left sm:text-right"><p className="font-bold text-slate-900">{product.reach.toFixed(1)}%</p><p className="mt-1 text-sm text-slate-600">{money(product.turnover)}</p></div></button></li>)}</ol> : <p className="mt-4 text-sm text-slate-500">У сегменті немає товарних позицій за вибраний період.</p>}</section> : null}
        {relatedProduct ? <section className="mt-6 rounded-2xl border border-brand/25 bg-brand/5 p-4"><h3 className="text-lg font-bold text-slate-900">Купують також</h3><p className="mt-1 text-sm text-slate-600">Обраний товар: <strong>{relatedProduct.name}</strong></p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setRelationMode('affinity')} className={`rounded-xl px-3 py-2 text-sm font-semibold ${relationMode === 'affinity' ? 'bg-brand text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>Афінність</button><button type="button" onClick={() => setRelationMode('together')} className={`rounded-xl px-3 py-2 text-sm font-semibold ${relationMode === 'together' ? 'bg-brand text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>Разом у чеку</button></div><p className="mt-3 rounded-xl bg-white/70 p-3 text-xs leading-5 text-slate-600">{relationMode === 'affinity' ? 'Афінність показує, у скільки разів покупці обраного товару беруть інший товар частіше, ніж середній покупець цього сегмента.' : 'Разом у чеку показує частку чеків з обраним товаром, у яких був також інший товар.'}</p>{relationsLoading ? <p className="mt-4 text-sm text-slate-600">Розраховую зв’язки товару…</p> : null}{relations ? <div className="mt-4"><p className="text-xs text-slate-500">База: {number(relations.baseCustomers)} покупців і {number(relations.baseOrders)} чеків з обраним товаром.</p><ol className="mt-3 space-y-3">{(relationMode === 'affinity' ? relations.affinity : relations.together).map((product, index) => <li key={product.code} className="rounded-xl border border-white bg-white p-3"><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="font-semibold text-slate-900">{product.name}</p><p className="whitespace-nowrap font-bold text-brand">{relationMode === 'affinity' ? `×${product.affinity.toFixed(1)}` : `${product.togetherShare.toFixed(1)}%`}</p></div><p className="mt-1 text-xs text-slate-500">{number(product.customers)} покупців беруть обидва · {number(product.sharedOrders)} спільних чеків</p><p className="mt-1 text-xs text-slate-600">{relationMode === 'affinity' ? `У покупців обраного товару: ${product.baseReach.toFixed(1)}%; у сегменті: ${product.segmentReach.toFixed(1)}%.` : `Товар є у ${product.togetherShare.toFixed(1)}% чеків з обраним товаром.`}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(relationMode === 'affinity' ? product.affinity / 3 * 100 : product.togetherShare, 100)}%` }} /></div></div></div></li>)}</ol></div> : null}</section> : null}
        {customers ? <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Ім’я</th><th className="p-3">Телефон</th><th className="p-3">ID Uployal</th><th className="p-3">Код у касовій системі</th><th className="p-3 text-right">Чеки</th><th className="p-3 text-right">Оборот</th><th className="p-3">Остання покупка</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.customerCode} className="border-t"><td className="p-3">{customer.fullName ?? '—'}</td><td className="p-3 whitespace-nowrap">{customer.mobilePhone ?? '—'}</td><td className="p-3">{customer.consumerUid ?? '—'}</td><td className="p-3">{customer.sourceCode ?? '—'}</td><td className="p-3 text-right">{number(customer.orders)}</td><td className="p-3 text-right">{money(customer.turnover)}</td><td className="p-3">{customer.lastPurchase ?? '—'}</td></tr>)}</tbody></table></div> : null}
      </section> : null}
    </> : null}
  </div>;
}
