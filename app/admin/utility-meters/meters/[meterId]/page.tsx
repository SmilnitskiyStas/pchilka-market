'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  UtilityMeterPointRecord,
  UtilityMeterRateRecord,
  UtilityMeterReadingHistoryItem
} from '@/lib/utility-metering-types';

type MeterDetailPayload = {
  ok?: boolean;
  meter?: UtilityMeterPointRecord;
  history?: UtilityMeterReadingHistoryItem[];
  rates?: UtilityMeterRateRecord[];
  error?: string;
};

function formatNumber(value?: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 4 }).format(value);
}

function formatMoney(value?: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function utilityTypeLabel(value: string) {
  switch (value) {
    case 'electricity_active':
      return 'Електроенергія (активна)';
    case 'electricity_reactive':
      return 'Електроенергія (реактивна)';
    case 'water':
      return 'Вода';
    case 'waste':
      return 'Вивіз відходів';
    case 'maintenance':
      return 'Обслуговування';
    case 'rent':
      return 'Оренда';
    default:
      return 'Інше';
  }
}

export default function AdminUtilityMeterDetailPage() {
  const params = useParams<{ meterId: string }>();
  const meterId = String(params?.meterId ?? '');
  const [payload, setPayload] = useState<MeterDetailPayload>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editingReading, setEditingReading] = useState<UtilityMeterReadingHistoryItem | null>(null);
  const [editingReadingDate, setEditingReadingDate] = useState('');
  const [editingReadingValue, setEditingReadingValue] = useState('');
  const [editingPreviousValue, setEditingPreviousValue] = useState('');
  const [isCreateReadingOpen, setIsCreateReadingOpen] = useState(false);
  const [newReadingDate, setNewReadingDate] = useState(new Date().toISOString().slice(0, 10));
  const [newReadingValue, setNewReadingValue] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadMeter = useCallback(async () => {
    if (!meterId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/utility-meters/points?${new URLSearchParams({ meterPointId: meterId }).toString()}`, {
        cache: 'no-store'
      });
      const result = (await response.json()) as MeterDetailPayload;
      setPayload(result);
    } catch (error) {
      setPayload({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити лічильник.' });
    } finally {
      setIsLoading(false);
    }
  }, [meterId]);

  useEffect(() => {
    void loadMeter();
  }, [loadMeter]);

  function startReadingEdit(item: UtilityMeterReadingHistoryItem) {
    setEditingReading(item);
    setEditingReadingDate(item.reading.readingDate);
    setEditingReadingValue(String(item.reading.readingValue));
    setEditingPreviousValue(item.charge?.previousValue == null ? '' : String(item.charge.previousValue));
    setEditStatus('');
  }

  async function saveReadingEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingReading) return;
    setIsSavingEdit(true);
    setEditStatus('');
    try {
      const response = await fetch('/api/admin/utility-meters/points', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meterPointId: meterId,
          readingId: editingReading.reading.id,
          readingDate: editingReadingDate,
          readingValue: editingReadingValue,
          previousValueOverride: editingPreviousValue
        })
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося оновити показник.');
      setEditingReading(null);
      setEditStatus('Показник оновлено, усі наступні нарахування перераховано.');
      await loadMeter();
    } catch (error) {
      setEditStatus(error instanceof Error ? error.message : 'Не вдалося оновити показник.');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function createReading(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingEdit(true);
    setEditStatus('');
    try {
      const response = await fetch('/api/admin/utility-meters/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createReading: true, meterPointId: meterId, readingDate: newReadingDate, readingValue: newReadingValue })
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося додати показник.');
      setNewReadingValue('');
      setIsCreateReadingOpen(false);
      setEditStatus('Новий показник додано та нарахування перераховано.');
      await loadMeter();
    } catch (error) {
      setEditStatus(error instanceof Error ? error.message : 'Не вдалося додати показник.');
    } finally {
      setIsSavingEdit(false);
    }
  }

  const meter = payload.meter;
  const history = payload.history ?? [];
  const rates = payload.rates ?? [];
  const totals = useMemo(() => {
    return history.reduce(
      (acc, item) => {
        acc.readings += 1;
        acc.totalAmount += item.charge?.amount ?? 0;
        if (item.charge?.validationStatus === 'ok') acc.ok += 1;
        if (item.charge?.validationStatus === 'warning') acc.warning += 1;
        if (item.charge?.validationStatus === 'error') acc.error += 1;
        return acc;
      },
      { readings: 0, totalAmount: 0, ok: 0, warning: 0, error: 0 }
    );
  }, [history]);

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Комунальні нарахування</p>
            <h1 className="mt-1 text-3xl font-bold">Історія лічильника</h1>
            <p className="mt-2 text-sm text-slate-600">
              Тут видно, коли вносилися показники, хто їх подавав, як рахувалось споживання та яка сума формувалась.
            </p>
          </div>
          <Link
            href="/admin/utility-meters"
            className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
          >
            До списку лічильників
          </Link>
        </section>

        {isLoading ? (
          <div className="rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">Завантаження...</div>
        ) : payload.error || !meter ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">
            {payload.error || 'Лічильник не знайдено.'}
          </div>
        ) : (
          <>
            <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-500">Лічильник</div>
                  <div className="mt-1 text-2xl font-bold">{meter.utilityLabel}</div>
                  <div className="mt-1 text-sm text-slate-600">{utilityTypeLabel(meter.utilityType)}</div>
                  <div className="mt-2 text-sm text-slate-600">{meter.storeCode || meter.storeLabel}</div>
                  <div className="text-sm text-slate-500">{meter.addressLine}</div>
                </div>
                <div className="grid gap-2 text-sm text-slate-700 sm:text-right">
                  <div>Номер: {meter.meterNumber || 'Без номера'}</div>
                  <div>Коефіцієнт: {formatNumber(meter.coefficient)}</div>
                  <div>Початковий показник: {formatNumber(meter.initialReadingValue)}</div>
                  <div>Базовий тариф: {formatMoney(meter.defaultRate)}</div>
                  <div>Стан: {meter.isActive ? 'Активний' : 'Вимкнений'}</div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Внесено показників</div>
                <div className="text-2xl font-bold">{totals.readings}</div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Ок</div>
                <div className="text-2xl font-bold text-green-700">{totals.ok}</div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Зауваження / помилки</div>
                <div className="text-2xl font-bold text-amber-700">{totals.warning + totals.error}</div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Сумарно нараховано</div>
                <div className="text-2xl font-bold">{formatMoney(totals.totalAmount)}</div>
              </div>
            </section>

            <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Історія показників</h2>
                  <p className="mt-1 text-sm text-slate-600">Кожен запис показує період, дату внесення, автора та результат розрахунку.</p>
                </div>
                <button type="button" onClick={() => { setIsCreateReadingOpen((value) => !value); setEditStatus(''); }} className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                  {isCreateReadingOpen ? 'Скасувати' : 'Додати показник'}
                </button>
              </div>

              {editStatus ? <div className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-900 ring-1 ring-blue-200">{editStatus}</div> : null}
              {isCreateReadingOpen ? (
                <form onSubmit={createReading} className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Дата показника
                    <input type="date" value={newReadingDate} onChange={(event) => setNewReadingDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2" required />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Новий поточний показник
                    <input inputMode="decimal" value={newReadingValue} onChange={(event) => setNewReadingValue(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2" required />
                    <span className="mt-1 block text-xs font-normal text-slate-600">Попередній буде взято з останнього показника або стартового значення.</span>
                  </label>
                  <div className="flex items-end">
                    <button type="submit" disabled={isSavingEdit} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSavingEdit ? 'Збереження…' : 'Додати'}</button>
                  </div>
                </form>
              ) : null}
              {editingReading ? (
                <form onSubmit={saveReadingEdit} className="mt-4 grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 sm:grid-cols-4">
                  <label className="block text-sm font-semibold text-slate-700">
                    Дата показника
                    <input type="date" value={editingReadingDate} onChange={(event) => setEditingReadingDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2" required />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Попередній показник
                    <input inputMode="decimal" value={editingPreviousValue} onChange={(event) => setEditingPreviousValue(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2" placeholder="Автоматично" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Поточний показник
                    <input inputMode="decimal" value={editingReadingValue} onChange={(event) => setEditingReadingValue(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2" required />
                  </label>
                  <div className="flex items-end gap-2">
                    <button type="submit" disabled={isSavingEdit} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSavingEdit ? 'Збереження…' : 'Зберегти'}</button>
                    <button type="button" onClick={() => setEditingReading(null)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800">Скасувати</button>
                  </div>
                </form>
              ) : null}

              {history.length === 0 ? (
                <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">Для цього лічильника ще немає історії показників.</div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-3">Період</th>
                        <th className="px-3 py-3">Дата</th>
                        <th className="px-3 py-3">Хто вніс</th>
                        <th className="px-3 py-3">Попередній</th>
                        <th className="px-3 py-3">Поточний</th>
                        <th className="px-3 py-3">Споживання</th>
                        <th className="px-3 py-3">Тариф</th>
                        <th className="px-3 py-3">Сума</th>
                        <th className="px-3 py-3">Статус</th>
                        <th className="px-3 py-3">Дія</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((item) => (
                        <tr key={item.reading.id}>
                          <td className="px-3 py-3 align-top font-medium">{item.reading.periodMonth.slice(0, 7)}</td>
                          <td className="px-3 py-3 align-top">{item.reading.readingDate}</td>
                          <td className="px-3 py-3 align-top">{item.reading.submittedByName || 'Не вказано'}</td>
                          <td className="px-3 py-3 align-top">{formatNumber(item.charge?.previousValue)}</td>
                          <td className="px-3 py-3 align-top">{formatNumber(item.reading.readingValue)}</td>
                          <td className="px-3 py-3 align-top">{formatNumber(item.charge?.consumption)}</td>
                          <td className="px-3 py-3 align-top">{formatMoney(item.charge?.rate)}</td>
                          <td className="px-3 py-3 align-top">{formatMoney(item.charge?.amount)}</td>
                          <td className="px-3 py-3 align-top">
                            <div>
                              <span
                                className={
                                  item.charge?.validationStatus === 'ok'
                                    ? 'rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800'
                                    : item.charge?.validationStatus === 'error'
                                      ? 'rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800'
                                      : 'rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800'
                                }
                              >
                                {item.charge?.validationStatus ?? 'missing'}
                              </span>
                              {item.charge?.validationMessages?.length ? (
                                <div className="mt-2 max-w-sm text-xs text-slate-600">{item.charge.validationMessages.join(' ')}</div>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <button type="button" onClick={() => startReadingEdit(item)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900">Редагувати</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold">Історія тарифів</h2>
              {rates.length === 0 ? (
                <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">Для цього лічильника ще немає окремо створених тарифів.</div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-3">Період</th>
                        <th className="px-3 py-3">Тариф</th>
                        <th className="px-3 py-3">Опис</th>
                        <th className="px-3 py-3">Рівень</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rates.map((rate) => (
                        <tr key={rate.id}>
                          <td className="px-3 py-3">{rate.periodMonth.slice(0, 7)}</td>
                          <td className="px-3 py-3 font-medium">{formatMoney(rate.rate)}</td>
                          <td className="px-3 py-3">{rate.rateLabel || '—'}</td>
                          <td className="px-3 py-3">{rate.meterPointId ? 'Лічильник' : 'Магазин'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
