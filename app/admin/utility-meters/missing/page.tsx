import Link from 'next/link';

import { listStoresFromDb } from '@/lib/stores-repository';
import { listUtilityMeterReviewInDb } from '@/lib/utility-metering-repository';
import type { UtilityMeterPointRecord, UtilityType } from '@/lib/utility-metering-types';

export const dynamic = 'force-dynamic';

const UTILITY_TYPE_LABELS: Record<UtilityType, string> = {
  electricity_active: 'Електроенергія (активна)',
  electricity_reactive: 'Електроенергія (реактивна)',
  water: 'Вода',
  waste: 'Вивіз відходів',
  maintenance: 'Обслуговування',
  rent: 'Оренда',
  other: 'Інше'
};

type PageProps = {
  searchParams: Promise<{ periodMonth?: string; region?: string }>;
};

function currentPeriodMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function normalizePeriodMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  return value && /^\d{4}-\d{2}-01$/.test(value) ? value : currentPeriodMonth();
}

function meterOwnerLabel(meter: UtilityMeterPointRecord) {
  if (meter.ownerKind === 'tenant') return ['Орендар', meter.tenantName].filter(Boolean).join(' · ');
  if (meter.ownerKind === 'shared') return ['Спільний', meter.tenantName].filter(Boolean).join(' · ');
  if (meter.ownerKind === 'other') return 'Інше';
  return 'Магазин';
}

function meterLabel(meter: UtilityMeterPointRecord) {
  return [meter.utilityLabel || UTILITY_TYPE_LABELS[meter.utilityType], meter.meterNumber ? `№${meter.meterNumber}` : ''].filter(Boolean).join(' · ');
}

export default async function UtilityMetersMissingReadingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const periodMonth = normalizePeriodMonth(params.periodMonth);
  const selectedRegion = String(params.region ?? '').trim();
  const [stores, review] = await Promise.all([listStoresFromDb(), listUtilityMeterReviewInDb({ periodMonth })]);
  const storesById = new Map(stores.map((store) => [store.id, store]));
  const regions = [...new Set(stores.map((store) => store.region.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'uk'));
  const missing = review.filter((meter) => {
    if (meter.reading) return false;
    if (!selectedRegion) return true;
    return storesById.get(meter.storeId ?? '')?.region.trim() === selectedRegion;
  });
  const grouped = new Map<string, typeof missing>();
  for (const meter of missing) {
    const key = meter.storeId || `code:${meter.storeCode}`;
    grouped.set(key, [...(grouped.get(key) ?? []), meter]);
  }
  const storeGroups = [...grouped.entries()]
    .map(([storeId, meters]) => ({ storeId, store: storesById.get(storeId), meters }))
    .sort((left, right) => left.meters.length - right.meters.length || left.meters[0].storeCode.localeCompare(right.meters[0].storeCode, 'uk'));
  const storeMeters = missing.filter((meter) => meter.ownerKind === 'store').length;
  const tenantMeters = missing.filter((meter) => meter.ownerKind === 'tenant').length;
  const query = new URLSearchParams({ periodMonth, ...(selectedRegion ? { region: selectedRegion } : {}) }).toString();

  return (
    <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Контроль показників</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Не внесені показники лічильників</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Список активних лічильників, за якими ще немає показника за обраний місяць.</p>
        </div>
        <Link href={`/admin/utility-meters?${query}`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          До лічильників
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Місяць показників
          <input name="periodMonth" type="month" defaultValue={periodMonth.slice(0, 7)} className="rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="grid min-w-52 gap-1 text-sm font-medium text-slate-700">
          Регіон
          <select name="region" defaultValue={selectedRegion} className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <option value="">Усі регіони</option>
            {regions.map((region) => <option key={region} value={region}>{region}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Показати</button>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Магазини без показників', String(storeGroups.length), 'text-amber-700'],
          ['Не внесено лічильників', String(missing.length), 'text-red-700'],
          ['Лічильники магазину', String(storeMeters), 'text-slate-950'],
          ['Лічильники орендарів', String(tenantMeters), 'text-slate-950']
        ].map(([label, value, valueClass]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
          </div>
        ))}
      </section>

      {storeGroups.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-800">За обраними умовами всі активні лічильники мають внесені показники.</div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">Натисніть на лічильник, щоб переглянути історію або додати показник.</div>
          <div className="divide-y divide-slate-200">
            {storeGroups.map(({ storeId, store, meters }) => (
              <article key={storeId} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-slate-950">{meters[0].storeCode || store?.storeCode || 'Магазин'} · {store?.name || meters[0].storeLabel}</h2>
                    <p className="mt-1 text-sm text-slate-600">{[store?.city, store?.addressLine || meters[0].addressLine].filter(Boolean).join(', ')}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">Не внесено: {meters.length}</span>
                </div>
                <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {meters.map((meter) => (
                    <li key={meter.id}>
                      <Link href={`/admin/utility-meters/meters/${meter.id}?${new URLSearchParams({ periodMonth, ...(meter.storeId ? { storeId: meter.storeId } : {}) }).toString()}`} className="block rounded-lg border border-slate-200 p-3 text-sm hover:border-amber-400 hover:bg-amber-50">
                        <p className="font-semibold text-slate-950">{meterLabel(meter)}</p>
                        <p className="mt-1 text-slate-600">{UTILITY_TYPE_LABELS[meter.utilityType]} · {meterOwnerLabel(meter)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
