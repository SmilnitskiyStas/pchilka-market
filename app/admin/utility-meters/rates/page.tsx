'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import type { UtilityMeterPointRecord, UtilityMeterRateRecord, UtilityType } from '@/lib/utility-metering-types';

type StoreView = {
  id: string;
  storeCode: string;
  name: string;
  city: string;
  addressLine: string;
  isActive: boolean;
};

type StoresPayload = {
  ok?: boolean;
  stores?: StoreView[];
  error?: string;
};

type MeterPointsPayload = {
  ok?: boolean;
  meters?: UtilityMeterPointRecord[];
  error?: string;
};

type RatesPayload = {
  ok?: boolean;
  rates?: UtilityMeterRateRecord[];
  rate?: UtilityMeterRateRecord;
  error?: string;
};

type RateFormState = {
  periodMonth: string;
  utilityType: UtilityType;
  scope: 'store' | 'meter';
  meterPointId: string;
  rate: string;
  rateLabel: string;
  includesVat: boolean;
};

const UTILITY_TYPE_OPTIONS: Array<{ value: UtilityType; label: string }> = [
  { value: 'electricity_active', label: 'Електроенергія (активна)' },
  { value: 'electricity_reactive', label: 'Електроенергія (реактивна)' },
  { value: 'water', label: 'Вода' },
  { value: 'waste', label: 'Вивіз відходів' },
  { value: 'maintenance', label: 'Обслуговування' },
  { value: 'rent', label: 'Оренда' },
  { value: 'other', label: 'Інше' }
];

function currentPeriodMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

const EMPTY_FORM: RateFormState = {
  periodMonth: currentPeriodMonth(),
  utilityType: 'electricity_active',
  scope: 'store',
  meterPointId: '',
  rate: '',
  rateLabel: '',
  includesVat: true
};

function monthInputValue(value: string) {
  return value.slice(0, 7);
}

function normalizePeriodMonth(value: string | null) {
  if (value && /^\d{4}-\d{2}-01$/.test(value)) return value;
  return currentPeriodMonth();
}

function getStoreLabel(store: StoreView) {
  return [store.storeCode, store.name || store.addressLine].filter(Boolean).join(' · ') || `Магазин #${store.id}`;
}

function getMeterLabel(meter: UtilityMeterPointRecord) {
  return [meter.utilityLabel, meter.meterNumber, meter.tenantName].filter(Boolean).join(' | ');
}

function formatRate(value: number) {
  return new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value);
}

export default function AdminUtilityMeterRatesPage() {
  const searchParams = useSearchParams();
  const initialStoreId = searchParams.get('storeId') ?? '';
  const initialPeriodMonth = normalizePeriodMonth(searchParams.get('periodMonth'));
  const [stores, setStores] = useState<StoreView[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState(initialStoreId);
  const [periodMonth, setPeriodMonth] = useState(initialPeriodMonth);
  const [meters, setMeters] = useState<UtilityMeterPointRecord[]>([]);
  const [rates, setRates] = useState<UtilityMeterRateRecord[]>([]);
  const [form, setForm] = useState<RateFormState>({ ...EMPTY_FORM, periodMonth: initialPeriodMonth });
  const [editingRateId, setEditingRateId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingRateId, setDeletingRateId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const activeStores = useMemo(() => stores.filter((store) => store.isActive), [stores]);
  const selectedStore = useMemo(
    () => activeStores.find((store) => store.id === selectedStoreId) ?? null,
    [activeStores, selectedStoreId]
  );
  const selectedMeter = useMemo(
    () => meters.find((meter) => meter.id === form.meterPointId) ?? null,
    [meters, form.meterPointId]
  );

  async function loadStores() {
    const response = await fetch('/api/admin/utility-meters/stores', { cache: 'no-store' });
    const result = (await response.json()) as StoresPayload;
    if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося завантажити магазини.');
    setStores(result.stores ?? []);
  }

  async function loadMeters(storeId: string) {
    if (!storeId) {
      setMeters([]);
      return;
    }

    const response = await fetch(`/api/admin/utility-meters/points?${new URLSearchParams({ storeId }).toString()}`, {
      cache: 'no-store'
    });
    const result = (await response.json()) as MeterPointsPayload;
    if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося завантажити лічильники.');
    setMeters(result.meters ?? []);
  }

  async function loadRates(nextStoreId = selectedStoreId, nextPeriodMonth = periodMonth) {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ periodMonth: nextPeriodMonth });
      if (nextStoreId) params.set('storeId', nextStoreId);
      const response = await fetch(`/api/admin/utility-meters/rates?${params.toString()}`, { cache: 'no-store' });
      const result = (await response.json()) as RatesPayload;
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося завантажити тарифи.');
      setRates(result.rates ?? []);
    } catch (nextError) {
      setRates([]);
      setError(nextError instanceof Error ? nextError.message : 'Не вдалося завантажити тарифи.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadStores();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Не вдалося завантажити магазини.');
      }
    })();
  }, []);

  useEffect(() => {
    void loadRates(selectedStoreId, periodMonth);
    void loadMeters(selectedStoreId).catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : 'Не вдалося завантажити лічильники.');
    });
  }, [selectedStoreId, periodMonth]);

  useEffect(() => {
    if (form.scope !== 'meter' || !selectedMeter) return;
    if (form.utilityType === selectedMeter.utilityType) return;
    setForm((current) => ({ ...current, utilityType: selectedMeter.utilityType }));
  }, [form.scope, form.utilityType, selectedMeter]);

  function resetForm(nextPeriodMonth = periodMonth) {
    setEditingRateId('');
    setForm({ ...EMPTY_FORM, periodMonth: nextPeriodMonth });
  }

  function startEdit(rate: UtilityMeterRateRecord) {
    setEditingRateId(rate.id);
    setForm({
      periodMonth: rate.periodMonth,
      utilityType: rate.utilityType,
      scope: rate.meterPointId ? 'meter' : 'store',
      meterPointId: rate.meterPointId ?? '',
      rate: String(rate.rate),
      rateLabel: rate.rateLabel,
      includesVat: rate.includesVat
    });
    if (rate.storeId) {
      setSelectedStoreId(rate.storeId);
    }
    setStatus('');
    setError('');
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStoreId) {
      setError('Спочатку оберіть магазин.');
      return;
    }

    setIsSaving(true);
    setStatus('');
    setError('');

    try {
      const response = await fetch('/api/admin/utility-meters/rates', {
        method: editingRateId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingRateId ? { rateId: editingRateId } : {}),
          storeId: selectedStoreId,
          meterPointId: form.scope === 'meter' ? form.meterPointId : null,
          utilityType: form.utilityType,
          periodMonth: form.periodMonth,
          rate: Number(form.rate.replace(',', '.')),
          rateLabel: form.rateLabel,
          includesVat: form.includesVat
        })
      });

      const result = (await response.json()) as RatesPayload;
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Не вдалося зберегти тариф.');
      }

      setStatus(editingRateId ? 'Тариф оновлено.' : 'Тариф додано.');
      resetForm(periodMonth);
      await loadRates(selectedStoreId, periodMonth);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Не вдалося зберегти тариф.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(rateId: string) {
    setDeletingRateId(rateId);
    setStatus('');
    setError('');

    try {
      const response = await fetch(`/api/admin/utility-meters/rates?${new URLSearchParams({ rateId }).toString()}`, {
        method: 'DELETE'
      });
      const result = (await response.json()) as RatesPayload;
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Не вдалося видалити тариф.');
      }

      if (editingRateId === rateId) {
        resetForm(periodMonth);
      }
      setStatus('Тариф видалено.');
      await loadRates(selectedStoreId, periodMonth);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Не вдалося видалити тариф.');
    } finally {
      setDeletingRateId('');
    }
  }

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="flex w-full max-w-none flex-col gap-5">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Комунальні нарахування</p>
            <h1 className="mt-1 text-3xl font-bold">Тарифи по лічильниках</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Додавайте помісячні тарифи для магазину або конкретного лічильника, щоб розрахунки суми й документів на оплату були коректними.
            </p>
          </div>
          <Link
            href="/admin/utility-meters"
            className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
          >
            До показників
          </Link>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-72 text-sm font-semibold text-slate-700">
              Магазин
              <select
                value={selectedStoreId}
                onChange={(event) => {
                  setSelectedStoreId(event.target.value);
                  setStatus('');
                  setError('');
                  resetForm(periodMonth);
                }}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              >
                <option value="">Оберіть магазин</option>
                {activeStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {getStoreLabel(store)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Місяць
              <input
                type="month"
                value={monthInputValue(periodMonth)}
                onChange={(event) => {
                  const nextPeriodMonth = `${event.target.value}-01`;
                  setPeriodMonth(nextPeriodMonth);
                  setForm((current) => ({ ...current, periodMonth: nextPeriodMonth }));
                }}
                className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-base"
              />
            </label>
          </div>
          {selectedStore ? (
            <div className="mt-3 text-sm text-slate-600">
              Активний магазин: <span className="font-medium text-slate-900">{getStoreLabel(selectedStore)}</span>
            </div>
          ) : null}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
          <form onSubmit={handleSave} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{editingRateId ? 'Редагування тарифу' : 'Новий тариф'}</h2>
              {editingRateId ? (
                <button
                  type="button"
                  onClick={() => resetForm(periodMonth)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                >
                  Скасувати
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3">
              <label className="block text-sm font-semibold text-slate-700">
                Місяць тарифу
                <input
                  type="month"
                  value={monthInputValue(form.periodMonth)}
                  onChange={(event) => setForm((current) => ({ ...current, periodMonth: `${event.target.value}-01` }))}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  required
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Тип послуги
                <select
                  value={form.utilityType}
                  onChange={(event) => setForm((current) => ({ ...current, utilityType: event.target.value as UtilityType }))}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  disabled={form.scope === 'meter' && Boolean(selectedMeter)}
                >
                  {UTILITY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Рівень тарифу
                <select
                  value={form.scope}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scope: event.target.value as 'store' | 'meter',
                      meterPointId: event.target.value === 'store' ? '' : current.meterPointId,
                      utilityType:
                        event.target.value === 'meter' && current.meterPointId
                          ? (meters.find((meter) => meter.id === current.meterPointId)?.utilityType ?? current.utilityType)
                          : current.utilityType
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                >
                  <option value="store">Для всього магазину</option>
                  <option value="meter">Для конкретного лічильника</option>
                </select>
              </label>

              {form.scope === 'meter' ? (
                <label className="block text-sm font-semibold text-slate-700">
                  Лічильник
                  <select
                    value={form.meterPointId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        meterPointId: event.target.value,
                        utilityType:
                          meters.find((meter) => meter.id === event.target.value)?.utilityType ?? current.utilityType
                      }))
                    }
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                    required
                  >
                    <option value="">Оберіть лічильник</option>
                    {meters.map((meter) => (
                      <option key={meter.id} value={meter.id}>
                        {getMeterLabel(meter)}
                      </option>
                    ))}
                  </select>
                  {selectedMeter ? (
                    <div className="mt-2 text-xs font-medium text-slate-500">
                      Тип послуги для цього лічильника буде використано автоматично.
                    </div>
                  ) : null}
                </label>
              ) : null}

              <label className="block text-sm font-semibold text-slate-700">
                Тариф, грн
                <input
                  inputMode="decimal"
                  value={form.rate}
                  onChange={(event) => setForm((current) => ({ ...current, rate: event.target.value }))}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  placeholder="Наприклад: 4.32"
                  required
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Опис / джерело тарифу
                <input
                  value={form.rateLabel}
                  onChange={(event) => setForm((current) => ({ ...current, rateLabel: event.target.value }))}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  placeholder="Наприклад: Тариф постачальника за липень"
                />
              </label>

              <label className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.includesVat}
                  onChange={(event) => setForm((current) => ({ ...current, includesVat: event.target.checked }))}
                  className="h-4 w-4"
                />
                Тариф включає ПДВ
              </label>
            </div>

            <button
              type="submit"
              disabled={isSaving || !selectedStoreId}
              className="mt-4 w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Збереження...' : editingRateId ? 'Зберегти зміни' : 'Додати тариф'}
            </button>

            {status ? <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{status}</div> : null}
            {error ? <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</div> : null}
          </form>

          <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Список тарифів</h2>
                <p className="mt-1 text-sm text-slate-600">Для вибраного магазину та місяця.</p>
              </div>
              <button
                type="button"
                onClick={() => void loadRates(selectedStoreId, periodMonth)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              >
                {isLoading ? 'Оновлення...' : 'Оновити'}
              </button>
            </div>

            {!selectedStoreId ? (
              <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">Оберіть магазин, щоб переглянути та додати тарифи.</div>
            ) : rates.length === 0 ? (
              <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">Для цього місяця ще немає тарифів.</div>
            ) : (
              <div className="mt-4 overflow-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-3">Послуга</th>
                      <th className="px-3 py-3">Рівень</th>
                      <th className="px-3 py-3">Тариф</th>
                      <th className="px-3 py-3">Опис</th>
                      <th className="px-3 py-3">Дія</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rates.map((rate) => (
                      <tr key={rate.id}>
                        <td className="px-3 py-3 align-top">
                          <div className="font-semibold">{UTILITY_TYPE_OPTIONS.find((item) => item.value === rate.utilityType)?.label ?? rate.utilityType}</div>
                          <div className="mt-1 text-xs text-slate-500">{rate.periodMonth.slice(0, 7)}</div>
                        </td>
                        <td className="px-3 py-3 align-top text-slate-700">
                          {rate.meterPointId ? (
                            <>
                              <div className="font-medium">Лічильник</div>
                              <div className="mt-1 text-xs text-slate-500">{rate.meterLabel || 'Без назви'}</div>
                            </>
                          ) : (
                            <>
                              <div className="font-medium">Магазин</div>
                              <div className="mt-1 text-xs text-slate-500">{rate.storeLabel || 'Без прив’язки'}</div>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="font-semibold">{formatRate(rate.rate)}</div>
                          <div className="mt-1 text-xs text-slate-500">{rate.includesVat ? 'З ПДВ' : 'Без ПДВ'}</div>
                        </td>
                        <td className="px-3 py-3 align-top text-slate-600">{rate.rateLabel || '—'}</td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(rate)}
                              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                            >
                              Редагувати
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(rate.id)}
                              disabled={deletingRateId === rate.id}
                              className="rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {deletingRateId === rate.id ? '...' : 'Видалити'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
