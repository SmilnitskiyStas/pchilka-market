'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type StoreOption = {
  id: string;
  storeCode: string;
  name: string;
  region: string;
  city: string;
  addressLine: string;
};

type Props = {
  stores: StoreOption[];
  selectedStoreIds: string[];
  periodMonth: string;
  audience: 'stores' | 'tenants';
};

function storeLabel(store: StoreOption) {
  return [store.storeCode, store.name || store.city, store.addressLine].filter(Boolean).join(' · ') || `Магазин #${store.id}`;
}

export function UtilityMeterDocumentStoreSelector({ stores, selectedStoreIds, periodMonth, audience }: Props) {
  const router = useRouter();
  const initialSelection = selectedStoreIds.length > 0 ? selectedStoreIds : stores.map((store) => store.id);
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState(periodMonth);
  const regions = useMemo(() => {
    const groups = new Map<string, StoreOption[]>();
    for (const store of stores) {
      const region = store.region.trim() || 'Без регіону';
      groups.set(region, [...(groups.get(region) ?? []), store]);
    }
    return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second, 'uk'));
  }, [stores]);
  const initialRegions = useMemo(() => {
    const selectedSet = new Set(initialSelection);
    return regions
      .filter(([, regionStores]) => regionStores.length > 0 && regionStores.every((store) => selectedSet.has(store.id)))
      .map(([region]) => region);
  }, [initialSelection, regions, stores.length]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(initialRegions);

  function toggleStore(storeId: string) {
    setSelected((current) => current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId]);
  }

  function toggleRegion(region: string) {
    const regionStoreIds = regions.find(([item]) => item === region)?.[1].map((store) => store.id) ?? [];
    if (selectedRegions.includes(region)) {
      setSelectedRegions((current) => current.filter((item) => item !== region));
      setSelected((current) => current.filter((storeId) => !regionStoreIds.includes(storeId)));
      return;
    }
    setSelectedRegions((current) => [...current, region]);
    setSelected((current) => [...new Set([...current, ...regionStoreIds])]);
  }

  function applySelection() {
    const params = new URLSearchParams({ periodMonth: selectedPeriodMonth, audience });
    if (selected.length > 0 && selected.length < stores.length) params.set('storeIds', selected.join(','));
    router.push(`/admin/utility-meters/document?${params.toString()}`);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Параметри документа</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Магазини та регіони</h2>
          <p className="mt-1 text-sm text-slate-600">Виберіть окремі магазини або регіони — вибір регіону автоматично додасть усі його магазини.</p>
        </div>
      </div>
      <label className="mt-4 flex w-fit items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
        <span>Період документа</span>
        <input
          type="month"
          value={selectedPeriodMonth.slice(0, 7)}
          onChange={(event) => setSelectedPeriodMonth(`${event.target.value}-01`)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-normal"
        />
      </label>
      <details className="relative mt-4 rounded-lg border border-slate-300 bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">Магазини та регіони: вибрано {selected.length} з {stores.length}</summary>
        <div className="border-t border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Швидкий вибір</span>
            <div className="flex gap-2 text-xs font-semibold"><button type="button" onClick={() => { setSelected(stores.map((store) => store.id)); setSelectedRegions(regions.map(([region]) => region)); }} className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50">Усі магазини</button><button type="button" onClick={() => { setSelected([]); setSelectedRegions([]); }} className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50">Очистити</button></div>
          </div>
          <div className="mt-3 border-b border-slate-100 pb-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Регіони</div><div className="mt-2 grid gap-1 sm:grid-cols-2">{regions.map(([region]) => <label key={region} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={selectedRegions.includes(region)} onChange={() => toggleRegion(region)} /><span>{region}</span></label>)}</div></div>
          <div className="mt-3 max-h-64 overflow-y-auto"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Магазини</div>{stores.map((store) => <label key={store.id} className="mt-1 flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={selected.includes(store.id)} onChange={() => { toggleStore(store.id); setSelectedRegions([]); }} className="mt-0.5" /><span>{storeLabel(store)}{store.region ? <span className="text-slate-500"> · {store.region}</span> : null}</span></label>)}</div>
        </div>
      </details>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="text-sm text-slate-600">Якщо вибрати всі магазини, сформується загальний документ.</span>
        <button type="button" onClick={applySelection} disabled={selected.length === 0} className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Сформувати документ ({selected.length || 0})</button>
      </div>
    </section>
  );
}
