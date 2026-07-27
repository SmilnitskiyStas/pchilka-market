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
  const regions = useMemo(() => {
    const groups = new Map<string, StoreOption[]>();
    for (const store of stores) {
      const region = store.region.trim() || 'Без регіону';
      groups.set(region, [...(groups.get(region) ?? []), store]);
    }
    return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second, 'uk'));
  }, [stores]);
  const initialRegion = useMemo(() => {
    const selectedSet = new Set(initialSelection);
    const matchingRegion = regions.find(([, regionStores]) => regionStores.length === selectedSet.size && regionStores.every((store) => selectedSet.has(store.id)));
    return matchingRegion?.[0] ?? (selectedSet.size === stores.length ? 'all' : 'custom');
  }, [initialSelection, regions, stores.length]);
  const [selectedRegion, setSelectedRegion] = useState(initialRegion);

  function toggleStore(storeId: string) {
    setSelected((current) => current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId]);
  }

  function selectRegion(value: string) {
    setSelectedRegion(value);
    if (value === 'custom') return;
    if (value === 'all') {
      setSelected(stores.map((store) => store.id));
      return;
    }
    const regionStores = regions.find(([region]) => region === value)?.[1] ?? [];
    setSelected(regionStores.map((store) => store.id));
  }

  function applySelection() {
    const params = new URLSearchParams({ periodMonth, audience });
    if (selected.length > 0 && selected.length < stores.length) params.set('storeIds', selected.join(','));
    router.push(`/admin/utility-meters/document?${params.toString()}`);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <div>
          <h2 className="text-base font-bold text-slate-950">Магазини для документа</h2>
          <p className="mt-1 text-sm text-slate-600">Оберіть готовий регіон або відкрийте список для ручного вибору магазинів.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Регіон
          <select value={selectedRegion} onChange={(event) => selectRegion(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base">
            <option value="all">Усі магазини</option>
            {regions.map(([region]) => <option key={region} value={region}>{region}</option>)}
            <option value="custom">Вручну вибрані магазини</option>
          </select>
        </label>
        <details className="group rounded-md border border-slate-300 bg-white">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-700">
            Магазини: вибрано {selected.length} з {stores.length}
          </summary>
          <div className="max-h-72 space-y-2 overflow-y-auto border-t border-slate-200 p-3">
            <div className="mb-2 flex gap-2 text-xs font-semibold">
              <button type="button" onClick={() => { setSelected(stores.map((store) => store.id)); setSelectedRegion('all'); }} className="rounded border border-slate-300 px-2 py-1">Усі</button>
              <button type="button" onClick={() => { setSelected([]); setSelectedRegion('custom'); }} className="rounded border border-slate-300 px-2 py-1">Очистити</button>
            </div>
            {stores.map((store) => (
              <label key={store.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={selected.includes(store.id)} onChange={() => { toggleStore(store.id); setSelectedRegion('custom'); }} className="mt-0.5" />
                <span>{storeLabel(store)}</span>
              </label>
            ))}
          </div>
        </details>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={applySelection} disabled={selected.length === 0} className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Сформувати документ ({selected.length || 0})</button>
        <span className="text-sm text-slate-600">Якщо вибрати всі магазини, сформується загальний документ.</span>
      </div>
    </section>
  );
}
