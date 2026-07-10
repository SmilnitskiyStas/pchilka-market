'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { readLocalDraft, removeLocalDraft, writeLocalDraft } from '@/lib/client-local-drafts';
import type { UtilityMeterPointRecord, UtilityMeterReadingHistoryItem } from '@/lib/utility-metering-types';

type ContextPayload = {
  ok?: boolean;
  user?: {
    id: number;
    name: string;
    surname: string;
    storeCode?: string;
    storeLabel: string;
  };
  meters?: UtilityMeterPointRecord[];
  historyByMeterId?: Record<string, UtilityMeterReadingHistoryItem[]>;
  error?: string;
};

type SubmitPayload = {
  ok?: boolean;
  calculation?: {
    validationStatus: string;
    validationMessages: string[];
    consumption?: number;
    amount?: number;
  };
  error?: string;
};

type HealthPayload = {
  ok?: boolean;
  error?: string;
};

type UtilityMeterDraft = {
  clientMutationId: string;
  selectedMeterId: string;
  readingDate: string;
  readingValue: string;
  previousValueOverride: string;
  notes: string;
};

type PendingUtilityMeterReading = {
  id: string;
  clientMutationId: string;
  token: string;
  meterPointId: string;
  readingDate: string;
  readingValue: number;
  previousValueOverride?: number;
  notes: string;
  createdAt: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthFromDate(value: string) {
  return value.slice(0, 7);
}

function updateDateMonth(currentDate: string, nextMonth: string) {
  const currentDay = Number(currentDate.slice(8, 10)) || 1;
  const [year, month] = nextMonth.split('-').map(Number);
  const maxDay = new Date(year, month, 0).getDate();
  const nextDay = String(Math.min(currentDay, maxDay)).padStart(2, '0');
  return `${nextMonth}-${nextDay}`;
}

function formatNumber(value?: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 4 }).format(value);
}

function formatMoney(value?: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatPeriodMonth(value: string) {
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

function getOwnerKindLabel(ownerKind: UtilityMeterPointRecord['ownerKind']) {
  if (ownerKind === 'tenant') return 'Орендар';
  if (ownerKind === 'shared') return 'Спільний';
  if (ownerKind === 'other') return 'Інше';
  return 'Магазин';
}

function getMeterOwnerLabel(meter: UtilityMeterPointRecord) {
  return [getOwnerKindLabel(meter.ownerKind), meter.tenantName, meter.legalEntity].filter(Boolean).join(' · ');
}

function getMeterLocationLabel(meter: UtilityMeterPointRecord) {
  return [meter.storeLabel || meter.storeCode, meter.addressLine].filter(Boolean).join(' · ');
}

function getMeterLabel(meter: UtilityMeterPointRecord) {
  return [
    meter.utilityLabel,
    meter.meterNumber ? `№${meter.meterNumber}` : '',
    getMeterOwnerLabel(meter),
    getMeterLocationLabel(meter)
  ]
    .filter(Boolean)
    .join(' | ');
}

function buildLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function UtilityMetersPage() {
  const [token, setToken] = useState('');
  const [payload, setPayload] = useState<ContextPayload>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [readingDate, setReadingDate] = useState(todayIso());
  const [readingValue, setReadingValue] = useState('');
  const [previousValueOverride, setPreviousValueOverride] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [isCheckingSync, setIsCheckingSync] = useState(false);
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  const [syncProcessed, setSyncProcessed] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [isServerReachable, setIsServerReachable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientMutationId, setClientMutationId] = useState(buildLocalId());
  const lastDraftKeyRef = useRef('');
  const isSyncingOutboxRef = useRef(false);

  const loadContext = useCallback(async (nextToken: string, preferredMeterId?: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/utility-meters/context?token=${encodeURIComponent(nextToken)}`, {
        cache: 'no-store'
      });
      const nextPayload = (await response.json()) as ContextPayload;
      setPayload(nextPayload);
      const meterIds = new Set((nextPayload.meters ?? []).map((meter) => meter.id));
      const fallbackMeterId = nextPayload.meters?.[0]?.id ?? '';
      setSelectedMeterId(preferredMeterId && meterIds.has(preferredMeterId) ? preferredMeterId : fallbackMeterId);
    } catch (error) {
      setPayload({
        ok: false,
        error: error instanceof Error ? error.message : 'Не вдалося завантажити дані.'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextToken = params.get('token') ?? '';
    setToken(nextToken);
    void loadContext(nextToken);
  }, [loadContext]);

  const selectedMeter = useMemo(
    () => payload.meters?.find((meter) => meter.id === selectedMeterId),
    [payload.meters, selectedMeterId]
  );

  const meterHistory = useMemo(
    () => (selectedMeterId ? payload.historyByMeterId?.[selectedMeterId] ?? [] : []),
    [payload.historyByMeterId, selectedMeterId]
  );

  const latestHistoryItem = meterHistory[0];
  const previousReading = latestHistoryItem?.reading;
  const readingMonth = monthFromDate(readingDate);

  const draftStorageKey = useMemo(() => {
    if (!token || !selectedMeterId) return '';
    return `utility-meter-draft:${token}:${selectedMeterId}`;
  }, [selectedMeterId, token]);

  const outboxStorageKey = useMemo(() => {
    if (!token) return '';
    return `utility-meter-outbox:${token}`;
  }, [token]);

  const readPendingQueue = useCallback(() => {
    if (!outboxStorageKey) return [] as PendingUtilityMeterReading[];
    return readLocalDraft<PendingUtilityMeterReading[]>(outboxStorageKey) ?? [];
  }, [outboxStorageKey]);

  const writePendingQueue = useCallback(
    (items: PendingUtilityMeterReading[]) => {
      if (!outboxStorageKey) return;
      if (items.length === 0) {
        removeLocalDraft(outboxStorageKey);
      } else {
        writeLocalDraft(outboxStorageKey, items);
      }
      setPendingCount(items.length);
    },
    [outboxStorageKey]
  );

  const postReading = useCallback(
    async (input: {
      token: string;
      meterPointId: string;
      readingDate: string;
      readingValue: number;
      clientMutationId: string;
      previousValueOverride?: number;
      notes: string;
    }) => {
      const response = await fetch('/api/utility-meters/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });

      let result: SubmitPayload | null = null;
      try {
        result = (await response.json()) as SubmitPayload;
      } catch {
        result = null;
      }

      return { response, result };
    },
    []
  );

  const checkServerReady = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false;
    }

    try {
      const response = await fetch('/api/health/db', {
        cache: 'no-store'
      });
      const result = (await response.json()) as HealthPayload;
      return response.ok && Boolean(result.ok);
    } catch {
      return false;
    }
  }, []);

  const flushPendingReadings = useCallback(async () => {
    if (!outboxStorageKey || isSyncingOutboxRef.current) return;

    const queue = readPendingQueue();
    if (queue.length === 0) {
      setPendingCount(0);
      setSyncProcessed(0);
      setSyncTotal(0);
      setIsCheckingSync(false);
      setIsSyncingPending(false);
      setIsServerReachable(null);
      return;
    }

    isSyncingOutboxRef.current = true;
    setIsCheckingSync(true);
    setIsServerReachable(null);
    setSyncProcessed(0);
    setSyncTotal(queue.length);
    setSyncStatus(`Знайдено локальні записи: ${queue.length}. Перевіряю доступність сервера...`);

    const serverReady = await checkServerReady();
    setIsCheckingSync(false);
    setIsServerReachable(serverReady);

    if (!serverReady) {
      setSyncStatus('Сервер тимчасово недоступний. Локальні записи залишаються на пристрої та будуть відправлені автоматично.');
      isSyncingOutboxRef.current = false;
      return;
    }

    const remaining: PendingUtilityMeterReading[] = [];
    let syncedCount = 0;
    let processedCount = 0;
    let blockedCount = 0;

    setIsSyncingPending(true);
    setSyncStatus(`Починаю синхронізацію локальних записів: 0/${queue.length}.`);

    try {
      for (const item of queue) {
        try {
          const { response, result } = await postReading({
            token: item.token,
            meterPointId: item.meterPointId,
            readingDate: item.readingDate,
            readingValue: item.readingValue,
            clientMutationId: item.clientMutationId,
            previousValueOverride: item.previousValueOverride,
            notes: item.notes
          });

          if (response.ok && result?.ok) {
            syncedCount += 1;
          } else {
            remaining.push(item);
            if (response.status < 500) {
              blockedCount += 1;
            }
          }
        } catch {
          remaining.push(item);
        } finally {
          processedCount += 1;
          setSyncProcessed(processedCount);
          setSyncStatus(`Синхронізую локальні записи: ${processedCount}/${queue.length}.`);
        }
      }
    } finally {
      writePendingQueue(remaining);
      isSyncingOutboxRef.current = false;
      setIsSyncingPending(false);
    }

    if (syncedCount > 0) {
      setSyncStatus(
        remaining.length > 0
          ? blockedCount > 0
            ? `Синхронізовано ${syncedCount}. Ще залишилось ${remaining.length} записів: частина потребує перевірки даних.`
            : `Синхронізовано ${syncedCount}. Ще очікують відправки: ${remaining.length}.`
          : `Усі локальні записи синхронізовано: ${syncedCount}.`
      );
      await loadContext(token, selectedMeterId || undefined);
      return;
    }

    setSyncStatus(
      remaining.length > 0
        ? blockedCount > 0
          ? `Локальні записи поки не передані: ${remaining.length}. Перевірте дані або повторіть синхронізацію пізніше.`
          : `Локальні записи ще очікують відправки: ${remaining.length}.`
        : ''
    );
  }, [checkServerReady, loadContext, outboxStorageKey, postReading, readPendingQueue, selectedMeterId, token, writePendingQueue]);

  const enqueuePendingReading = useCallback(
    (item: Omit<PendingUtilityMeterReading, 'id' | 'createdAt'>) => {
      const queue = readPendingQueue();
      writePendingQueue([
        ...queue,
        {
          id: buildLocalId(),
          createdAt: new Date().toISOString(),
          ...item
        }
      ]);
    },
    [readPendingQueue, writePendingQueue]
  );

  useEffect(() => {
    if (!outboxStorageKey) {
      setPendingCount(0);
      return;
    }
    setPendingCount(readPendingQueue().length);
  }, [outboxStorageKey, readPendingQueue]);

  useEffect(() => {
    if (!draftStorageKey || lastDraftKeyRef.current === draftStorageKey) return;

    lastDraftKeyRef.current = draftStorageKey;
    const savedDraft = readLocalDraft<UtilityMeterDraft>(draftStorageKey);

    if (savedDraft) {
      setClientMutationId(savedDraft.clientMutationId || buildLocalId());
      setReadingDate(savedDraft.readingDate || todayIso());
      setReadingValue(savedDraft.readingValue || '');
      setPreviousValueOverride(savedDraft.previousValueOverride || '');
      setNotes(savedDraft.notes || '');
      setDraftStatus('Чернетку відновлено з цього пристрою.');
      return;
    }

    setClientMutationId(buildLocalId());
    setReadingDate(todayIso());
    setReadingValue('');
    setPreviousValueOverride('');
    setNotes('');
    setDraftStatus('');
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey || isLoading) return;

    const hasDraftData = Boolean(readingValue.trim() || previousValueOverride.trim() || notes.trim() || readingDate !== todayIso());
    if (!hasDraftData) {
      removeLocalDraft(draftStorageKey);
      return;
    }

    writeLocalDraft<UtilityMeterDraft>(draftStorageKey, {
      clientMutationId,
      selectedMeterId,
      readingDate,
      readingValue,
      previousValueOverride,
      notes
    });

    if (!isSubmitting) {
      setDraftStatus('Чернетка зберігається на цьому пристрої.');
    }
  }, [clientMutationId, draftStorageKey, isLoading, isSubmitting, notes, previousValueOverride, readingDate, readingValue, selectedMeterId]);

  useEffect(() => {
    if (!token) return;
    void flushPendingReadings();
  }, [flushPendingReadings, token]);

  useEffect(() => {
    function handleOnline() {
      void flushPendingReadings();
    }

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushPendingReadings]);

  async function submitReading(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMeterId) {
      setStatus('Спочатку оберіть лічильник.');
      return;
    }

    setIsSubmitting(true);
    setStatus('');
    setSyncStatus('');

    const normalizedReadingValue = Number(readingValue.replace(',', '.'));
    const normalizedPreviousValue = previousValueOverride ? Number(previousValueOverride.replace(',', '.')) : undefined;

    try {
      const { response, result } = await postReading({
        token,
        meterPointId: selectedMeterId,
        readingDate,
        readingValue: normalizedReadingValue,
        clientMutationId,
        previousValueOverride: normalizedPreviousValue,
        notes
      });

      if (!response.ok || !result?.ok) {
        if (response.status >= 500) {
          throw new Error('__QUEUE_READING__');
        }
        throw new Error(result?.error || 'Не вдалося зберегти показник.');
      }

      const details = result.calculation?.validationMessages?.length
        ? ` Перевірка: ${result.calculation.validationMessages.join(' ')}`
        : '';
      setStatus(`Показник збережено.${details}`);
      if (draftStorageKey) {
        removeLocalDraft(draftStorageKey);
      }
      setDraftStatus('Локальну чернетку очищено після успішного збереження.');
      setReadingValue('');
      setPreviousValueOverride('');
      setNotes('');
      setClientMutationId(buildLocalId());
      await loadContext(token, selectedMeterId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не вдалося зберегти показник.';

      if (message === '__QUEUE_READING__' || message === 'Failed to fetch') {
        enqueuePendingReading({
          clientMutationId,
          token,
          meterPointId: selectedMeterId,
          readingDate,
          readingValue: normalizedReadingValue,
          previousValueOverride: normalizedPreviousValue,
          notes
        });
        if (draftStorageKey) {
          removeLocalDraft(draftStorageKey);
        }
        setReadingValue('');
        setPreviousValueOverride('');
        setNotes('');
        setClientMutationId(buildLocalId());
        setStatus('Сайт тимчасово недоступний. Показник збережено локально і буде надіслано автоматично.');
        setDraftStatus('Локальну чернетку перенесено в чергу очікування.');
        setSyncStatus('Є локальні записи, що очікують автоматичної синхронізації.');
      } else {
        setStatus(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const syncPercent = syncTotal > 0 ? Math.round((syncProcessed / syncTotal) * 100) : 0;
  const showSyncPanel = isCheckingSync || isSyncingPending || pendingCount > 0 || Boolean(syncStatus);

  return (
    <main className="min-h-screen w-full bg-slate-100 px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pchilka Market</p>
          <h1 className="mt-1 text-2xl font-bold">Показники лічильників</h1>
          {payload.user ? (
            <p className="mt-2 text-sm text-slate-600">
              {payload.user.surname} {payload.user.name}
              {payload.user.storeCode ? `, ${payload.user.storeCode}` : ''} | {payload.user.storeLabel}
            </p>
          ) : null}
        </section>

        {isLoading ? (
          <div className="rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">Завантаження...</div>
        ) : payload.error ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">{payload.error}</div>
        ) : payload.meters?.length ? (
          <form onSubmit={submitReading} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <label className="block text-sm font-semibold text-slate-700" htmlFor="meter">
              Лічильник
            </label>
            <select
              id="meter"
              value={selectedMeterId}
              onChange={(event) => {
                setSelectedMeterId(event.target.value);
                setPreviousValueOverride('');
                setStatus('');
                setSyncStatus('');
              }}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            >
              {payload.meters.map((meter) => (
                <option key={meter.id} value={meter.id}>
                  {getMeterLabel(meter)}
                </option>
              ))}
            </select>

            {selectedMeter ? (
              <div className="mt-3 grid gap-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-2">
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold">Лічильник:</span> {selectedMeter.utilityLabel}
                    {selectedMeter.meterNumber ? ` · №${selectedMeter.meterNumber}` : ''}
                  </div>
                  <div>
                    <span className="font-semibold">Хто використовує:</span> {getMeterOwnerLabel(selectedMeter)}
                  </div>
                  <div>
                    <span className="font-semibold">Місце:</span> {getMeterLocationLabel(selectedMeter) || 'Не вказано'}
                  </div>
                </div>
                <div className="space-y-1 sm:text-right">
                  <div>Коефіцієнт: {formatNumber(selectedMeter.coefficient)}</div>
                  <div>Початковий показник: {formatNumber(selectedMeter.initialReadingValue)}</div>
                  <div>Останній показник: {latestHistoryItem ? formatNumber(latestHistoryItem.reading.readingValue) : 'ще не внесено'}</div>
                </div>
              </div>
            ) : null}

            {showSyncPanel ? (
              <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">Синхронізація з пристрою</div>
                    <div className="mt-1">
                      {syncStatus ||
                        (pendingCount > 0
                          ? `Локально очікують відправки записів: ${pendingCount}.`
                          : 'Локальних записів, які очікують відправки, немає.')}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    {isCheckingSync
                      ? 'Перевірка сервера...'
                      : isSyncingPending
                        ? 'Триває синхронізація'
                        : isServerReachable === false
                          ? 'Сервер недоступний'
                          : isServerReachable === true
                            ? 'Сервер доступний'
                            : ''}
                  </div>
                </div>

                {syncTotal > 0 ? (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-blue-800">
                      <span>Прогрес передавання</span>
                      <span>
                        {syncProcessed}/{syncTotal}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${syncPercent}%` }} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Місяць
                <input
                  type="month"
                  value={readingMonth}
                  onChange={(event) => setReadingDate(updateDateMonth(readingDate, event.target.value))}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  required
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Дата зняття показника
                <input
                  type="date"
                  value={readingDate}
                  onChange={(event) => setReadingDate(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  required
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Поточний показник
                <input
                  inputMode="decimal"
                  value={readingValue}
                  onChange={(event) => setReadingValue(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  required
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Початковий / попередній показник
                <input
                  inputMode="decimal"
                  value={previousValueOverride}
                  onChange={(event) => setPreviousValueOverride(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  placeholder="Для першого або старого періоду"
                />
                {previousReading ? (
                  <span className="mt-1 block text-xs font-normal text-slate-600">
                    Для розрахунку буде автоматично використано показник {formatNumber(previousReading.readingValue)} за {formatPeriodMonth(previousReading.periodMonth)} ({previousReading.readingDate}). Залиште поле порожнім.
                  </span>
                ) : selectedMeter?.initialReadingValue != null ? (
                  <span className="mt-1 block text-xs font-normal text-slate-600">
                    Попередніх показників ще немає. Для розрахунку буде використано початковий показник лічильника: {formatNumber(selectedMeter.initialReadingValue)}. Залиште поле порожнім.
                  </span>
                ) : previousValueOverride.trim() ? (
                  <span className="mt-1 block text-xs font-normal text-slate-600">
                    Введене значення буде використано як початковий показник для розрахунку.
                  </span>
                ) : (
                  <span className="mt-1 block text-xs font-normal text-amber-700">
                    Це перший показник. Залиште поле порожнім: розрахунок споживання та суми не буде сформований, бо немає попередніх даних.
                  </span>
                )}
              </label>
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Коментар
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                placeholder="За потреби додайте пояснення до показника"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 w-full rounded-md bg-amber-500 px-4 py-3 text-base font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Збереження...' : 'Зберегти показник'}
            </button>

            {status ? <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-800">{status}</div> : null}
            {draftStatus ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{draftStatus}</div>
            ) : null}

            <section className="mt-5 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Останні показники</h2>
                  <p className="mt-1 text-xs text-slate-500">Тут можна швидко перевірити, які місяці вже внесені.</p>
                </div>
              </div>

              {meterHistory.length === 0 ? (
                <div className="mt-3 text-sm text-slate-500">Для цього лічильника ще немає збереженої історії.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {meterHistory.slice(0, 6).map((item) => (
                    <div
                      key={item.reading.id}
                      className="flex flex-col gap-2 rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-medium">
                          {item.reading.periodMonth.slice(0, 7)} | {item.reading.readingDate}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Попередній: {formatNumber(item.charge?.previousValue)} | Поточний: {formatNumber(item.reading.readingValue)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:text-right">
                        <span>Споживання: {formatNumber(item.charge?.consumption)}</span>
                        <span>Сума: {formatMoney(item.charge?.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </form>
        ) : (
          <div className="rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            Для цього магазину ще не налаштовано лічильники.
          </div>
        )}
      </div>
    </main>
  );
}
