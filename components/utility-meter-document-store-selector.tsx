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
    return [...groups.entries()];
  }, [stores]);

  function toggleStore(storeId: string) {
    setSelected((current) => current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId]);
  }

  function toggleRegion(regionStores: StoreOption[]) {
    const ids = regionStores.map((store) => store.id);
    const isFullySelected = ids.every((id) => selected.includes(id));
    setSelected((current) => isFullySelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]);
  }

  function applySelection() {
    const params = new URLSearchParams({ periodMonth, audience });
    if (selected.length > 0 && selected.length < stores.length) params.set('storeIds', selected.join(','));
    router.push(`/admin/utility-meters/document?${params.toString()}`);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Магазини для документа</h2>
          <p className="mt-1 text-sm text-slate-600">Позначте окремі магазини або одразу весь регіон.</p>
        </div>
        <div className="flex gap-2 text-sm font-semibold">
          <button type="button" onClick={() => setSelected(stores.map((store) => store.id))} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900">Усі магазини</button>
          <button type="button" onClick={() => setSelected([])} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900">Очистити</button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {regions.map(([region, regionStores]) => {
          const regionSelected = regionStores.every((store) => selected.includes(store.id));
          return (
            <fieldset key={region} className="rounded-md border border-slate-200 p-3">
              <label className="flex cursor-pointer items-center gap-2 font-bold text-slate-950">
                <input type="checkbox" checked={regionSelected} onChange={() => toggleRegion(regionStores)} />
                {region}
              </label>
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {regionStores.map((store) => (
                  <label key={store.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={selected.includes(store.id)} onChange={() => toggleStore(store.id)} className="mt-0.5" />
                    <span>{storeLabel(store)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={applySelection} className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Сформувати документ ({selected.length || 0})</button>
        <span className="text-sm text-slate-600">Якщо вибрати всі магазини, сформується загальний документ.</span>
      </div>
    </section>
  );
}
