import Link from 'next/link';

import { listStoresFromDb } from '@/lib/stores-repository';
import { listUtilityMeterRatesInDb, listUtilityMeterReviewInDb } from '@/lib/utility-metering-repository';
import type { UtilityMeterPointRecord, UtilityType } from '@/lib/utility-metering-types';

export const dynamic = 'force-dynamic';

const UTILITY_LABELS: Record<UtilityType, string> = {
  electricity_active: 'Електроенергія (активна)', electricity_reactive: 'Електроенергія (реактивна)', water: 'Вода',
  waste: 'Вивіз відходів', maintenance: 'Обслуговування', rent: 'Оренда', other: 'Інше'
};

type PageProps = { searchParams: Promise<{ periodMonth?: string; region?: string }> };

function currentPeriodMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function normalizePeriodMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  return value && /^\d{4}-\d{2}-01$/.test(value) ? value : currentPeriodMonth();
}

function meterLabel(meter: UtilityMeterPointRecord) {
  return [meter.utilityLabel || UTILITY_LABELS[meter.utilityType], meter.meterNumber ? `№${meter.meterNumber}` : ''].filter(Boolean).join(' · ');
}

export default async function UtilityMetersMissingRatesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const periodMonth = normalizePeriodMonth(params.periodMonth);
  const selectedRegion = String(params.region ?? '').trim();
  const [stores, meters, rates] = await Promise.all([
    listStoresFromDb(), listUtilityMeterReviewInDb({ periodMonth }), listUtilityMeterRatesInDb({ periodMonth })
  ]);
  const storesById = new Map(stores.map((store) => [store.id, store]));
  const regions = [...new Set(stores.map((store) => store.region.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
  const missing = meters.filter((meter) => {
    if (selectedRegion && storesById.get(meter.storeId ?? '')?.region.trim() !== selectedRegion) return false;
    return !rates.some((rate) =>
      rate.meterPointId === meter.id ||
      (!rate.meterPointId && rate.utilityType === meter.utilityType && (!rate.storeId || rate.storeId === meter.storeId))
    );
  });
  const groups = new Map<string, typeof missing>();
  for (const meter of missing) {
    const key = meter.storeId || `code:${meter.storeCode}`;
    groups.set(key, [...(groups.get(key) ?? []), meter]);
  }
  const storeGroups = [...groups.entries()].map(([storeId, metersForStore]) => ({ storeId, store: storesById.get(storeId), meters: metersForStore }))
    .sort((a, b) => b.meters.length - a.meters.length || a.meters[0].storeCode.localeCompare(b.meters[0].storeCode, 'uk'));
  const query = new URLSearchParams({ periodMonth, ...(selectedRegion ? { region: selectedRegion } : {}) }).toString();

  return <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Контроль тарифів</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Не внесені тарифи лічильників</h1><p className="mt-2 text-sm text-slate-600">Активні лічильники, для яких ще не додано тариф за обраний місяць.</p></div>
      <Link href={`/admin/utility-meters/rates?${new URLSearchParams({ periodMonth }).toString()}`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">До тарифів</Link>
    </div>
    <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="grid gap-1 text-sm font-medium text-slate-700">Місяць<input name="periodMonth" type="month" defaultValue={periodMonth.slice(0, 7)} className="rounded-md border border-slate-300 px-3 py-2" /></label>
      <label className="grid min-w-52 gap-1 text-sm font-medium text-slate-700">Регіон<select name="region" defaultValue={selectedRegion} className="rounded-md border border-slate-300 bg-white px-3 py-2"><option value="">Усі регіони</option>{regions.map((region) => <option key={region} value={region}>{region}</option>)}</select></label>
      <button type="submit" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Показати</button>
    </form>
    <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">Магазини без тарифів</p><p className="mt-1 text-2xl font-bold text-amber-700">{storeGroups.length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">Лічильники без тарифів</p><p className="mt-1 text-2xl font-bold text-red-700">{missing.length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">Тарифів додано</p><p className="mt-1 text-2xl font-bold text-emerald-700">{rates.length}</p></div></section>
    {storeGroups.length === 0 ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-800">Для всіх активних лічильників тарифи за цей місяць додано.</div> : <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="divide-y divide-slate-200">{storeGroups.map(({ storeId, store, meters: metersForStore }) => <article key={storeId} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold text-slate-950">{metersForStore[0].storeCode} · {store?.name || metersForStore[0].storeLabel}</h2><p className="mt-1 text-sm text-slate-600">{[store?.city, store?.addressLine || metersForStore[0].addressLine].filter(Boolean).join(', ')}</p></div><Link href={`/admin/utility-meters/rates?${new URLSearchParams({ periodMonth, ...(metersForStore[0].storeId ? { storeId: metersForStore[0].storeId } : {}) }).toString()}`} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white">Додати тариф</Link></div><ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{metersForStore.map((meter) => <li key={meter.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-semibold text-slate-950">{meterLabel(meter)}</p><p className="mt-1 text-slate-600">{UTILITY_LABELS[meter.utilityType]}</p></li>)}</ul></article>)}</div></section>}
  </main>;
}
