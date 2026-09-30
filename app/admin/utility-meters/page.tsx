'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import type {
  UtilityMeterOwnerKind,
  UtilityMeterPointRecord,
  UtilityMeterReviewItem,
  UtilityType
} from '@/lib/utility-metering-types';
import { parseUtilityMeterDecimal } from '@/lib/utility-metering-calculator';

type StoreView = {
  id: string;
  storeCode: string;
  name: string;
  region: string;
  city: string;
  addressLine: string;
  isActive: boolean;
};

type StoresPayload = {
  ok?: boolean;
  stores?: StoreView[];
  error?: string;
};

type ReviewPayload = {
  ok?: boolean;
  items?: UtilityMeterReviewItem[];
  totals?: {
    meters: number;
    submitted: number;
    ok: number;
    warning: number;
    error: number;
    amount: number;
  };
  error?: string;
};

type ConsumptionStatisticItem = {
  id: string;
  storeId?: string;
  storeCode: string;
  storeLabel: string;
  region: string;
  city: string;
  addressLine: string;
  utilityType: UtilityType;
  utilityLabel: string;
  meterNumber: string;
  readings: number;
  consumption: number;
  amount: number;
};

type ConsumptionStatisticsPayload = {
  ok?: boolean;
  items?: ConsumptionStatisticItem[];
  totals?: {
    meters: number;
    readings: number;
    consumption: number;
    amount: number;
  };
  error?: string;
};

type ConsumptionHistoryItem = {
  periodMonth: string;
  readings: number;
  consumption: number;
  amount: number;
};

type ConsumptionHistoryPayload = {
  ok?: boolean;
  items?: ConsumptionHistoryItem[];
  error?: string;
};

type AccessLinkPayload = {
  ok?: boolean;
  url?: string;
  user?: {
    id: string;
    name: string;
    role: string;
  };
  error?: string;
};

type ReminderRunPayload = {
  ok?: boolean;
  result?: {
    candidates: number;
    missingMeters: number;
    notificationsSent: number;
    skippedAlreadySent: number;
    failed: number;
  };
  error?: string;
};

type ReminderPreviewPayload = {
  ok?: boolean;
  preview?: {
    periodMonth: string;
    candidates: number;
    storesToNotify: number;
    missingMeters: number;
    skippedAlreadySent: number;
  };
  error?: string;
};

function UtilityMeterReviewTotals({
  totals,
  isShowingMissing,
  onToggleMissing
}: {
  totals: NonNullable<ReviewPayload['totals']>;
  isShowingMissing: boolean;
  onToggleMissing: () => void;
}) {
  const missing = Math.max(0, totals.meters - totals.submitted);

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200"><div className="text-sm text-slate-500">Лічильники</div><div className="text-2xl font-bold">{totals.meters}</div></div>
      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-sm text-slate-500">Подано</div><div className="text-2xl font-bold">{totals.submitted}</div></div>
          <button
            type="button"
            onClick={onToggleMissing}
            aria-pressed={isShowingMissing}
            className={`rounded-md px-2 py-1 text-right transition ${isShowingMissing ? 'bg-red-100 text-red-800 ring-1 ring-red-200' : 'text-red-600 hover:bg-red-50 hover:text-red-800'}`}
          >
            <span className="block text-sm">Не подано</span>
            <span className="block text-2xl font-bold">{missing}</span>
          </button>
        </div>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200"><div className="text-sm text-slate-500">Ок</div><div className="text-2xl font-bold text-green-700">{totals.ok}</div></div>
      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200"><div className="text-sm text-slate-500">Зауваження</div><div className="text-2xl font-bold text-amber-700">{totals.warning + totals.error}</div></div>
      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200"><div className="text-sm text-slate-500">Сума</div><div className="text-2xl font-bold">{money(totals.amount)}</div></div>
    </section>
  );
}

type MeterPointsPayload = {
  ok?: boolean;
  meters?: UtilityMeterPointRecord[];
  meter?: UtilityMeterPointRecord;
  error?: string;
};

type UtilityMeterRateView = {
  id: string;
  meterPointId?: string;
  storeId?: string;
  utilityType: UtilityType;
  periodMonth: string;
  rate: number;
  rateLabel: string;
  includesVat: boolean;
  meterLabel: string;
  storeLabel: string;
};

type RatesPayload = {
  ok?: boolean;
  rates?: UtilityMeterRateView[];
  error?: string;
};

type MeterFormState = {
  utilityType: UtilityType;
  utilityLabel: string;
  meterNumber: string;
  coefficient: string;
  initialReadingValue: string;
  initialReadingDate: string;
  defaultRate: string;
  ownerKind: UtilityMeterOwnerKind;
  tenantName: string;
  legalEntity: string;
  providerName: string;
  contractNumber: string;
  areaSqM: string;
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

const OWNER_KIND_OPTIONS: Array<{ value: UtilityMeterOwnerKind; label: string }> = [
  { value: 'store', label: 'Магазин' },
  { value: 'tenant', label: 'Орендар' },
  { value: 'shared', label: 'Спільний' },
  { value: 'other', label: 'Інше' }
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_METER_FORM: MeterFormState = {
  utilityType: 'electricity_active',
  utilityLabel: '',
  meterNumber: '',
  coefficient: '1',
  initialReadingValue: '',
  initialReadingDate: todayIso(),
  defaultRate: '',
  ownerKind: 'store',
  tenantName: '',
  legalEntity: '',
  providerName: '',
  contractNumber: '',
  areaSqM: ''
};

function meterToFormState(meter: UtilityMeterPointRecord): MeterFormState {
  return {
    utilityType: meter.utilityType,
    utilityLabel: meter.utilityLabel,
    meterNumber: meter.meterNumber,
    coefficient: String(meter.coefficient ?? 1),
    initialReadingValue: meter.initialReadingValue == null ? '' : String(meter.initialReadingValue),
    initialReadingDate: meter.initialReadingDate || todayIso(),
    defaultRate: meter.defaultRate == null ? '' : String(meter.defaultRate),
    ownerKind: meter.ownerKind,
    tenantName: meter.tenantName,
    legalEntity: meter.legalEntity,
    providerName: meter.providerName,
    contractNumber: meter.contractNumber,
    areaSqM: meter.areaSqM == null ? '' : String(meter.areaSqM)
  };
}

function currentPeriodMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function money(value?: number) {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function number(value?: number) {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 4 }).format(value);
}

function periodLabel(periodMonth: string) {
  return new Intl.DateTimeFormat('uk-UA', { month: 'short', year: 'numeric' }).format(new Date(`${periodMonth}T00:00:00`));
}

function utilityTypeBadge(utilityType: UtilityType) {
  const badges: Record<UtilityType, { label: string; className: string }> = {
    electricity_active: { label: 'Електрика', className: 'bg-amber-100 text-amber-900' },
    electricity_reactive: { label: 'Реакт. ел.', className: 'bg-orange-100 text-orange-900' },
    water: { label: 'Вода', className: 'bg-sky-100 text-sky-900' },
    waste: { label: 'Відходи', className: 'bg-lime-100 text-lime-900' },
    maintenance: { label: 'Обслуг.', className: 'bg-violet-100 text-violet-900' },
    rent: { label: 'Оренда', className: 'bg-rose-100 text-rose-900' },
    other: { label: 'Інше', className: 'bg-slate-100 text-slate-700' }
  };
  return badges[utilityType];
}

function getStoreLabel(store: StoreView) {
  return [store.storeCode, store.city, store.addressLine].filter(Boolean).join(' · ') || store.name || `Магазин #${store.id}`;
}

function getOwnerKindLabel(ownerKind: UtilityMeterOwnerKind) {
  if (ownerKind === 'tenant') return 'Орендар';
  if (ownerKind === 'shared') return 'Спільний';
  if (ownerKind === 'other') return 'Інше';
  return 'Магазин';
}

function getMeterOwnerLabel(meter: UtilityMeterPointRecord) {
  return [getOwnerKindLabel(meter.ownerKind), meter.tenantName, meter.legalEntity].filter(Boolean).join(' · ');
}

export default function AdminUtilityMetersPage() {
  const searchParams = useSearchParams();
  const initialStoreId = searchParams.get('storeId') ?? '';
  const requestedPeriodMonth = searchParams.get('periodMonth') ?? '';
  const initialPeriodMonth = /^\d{4}-\d{2}-01$/.test(requestedPeriodMonth) ? requestedPeriodMonth : currentPeriodMonth();
  const [periodMonth, setPeriodMonth] = useState(initialPeriodMonth);
  const [selectedStoreId, setSelectedStoreId] = useState(initialStoreId);
  const [statisticsPeriodFrom, setStatisticsPeriodFrom] = useState(initialPeriodMonth);
  const [statisticsPeriodTo, setStatisticsPeriodTo] = useState(initialPeriodMonth);
  const [statisticsStoreIds, setStatisticsStoreIds] = useState<string[]>(initialStoreId ? [initialStoreId] : []);
  const [statisticsRegions, setStatisticsRegions] = useState<string[]>([]);
  const [statisticsPayload, setStatisticsPayload] = useState<ConsumptionStatisticsPayload>({});
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);
  const [selectedChartMeter, setSelectedChartMeter] = useState<ConsumptionStatisticItem | null>(null);
  const [chartPayload, setChartPayload] = useState<ConsumptionHistoryPayload>({});
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [stores, setStores] = useState<StoreView[]>([]);
  const [payload, setPayload] = useState<ReviewPayload>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isShowingMissingMeters, setIsShowingMissingMeters] = useState(false);
  const [isCreatingAccessLink, setIsCreatingAccessLink] = useState(false);
  const [accessLinkStatus, setAccessLinkStatus] = useState('');
  const [isCreatingDocumentShareLink, setIsCreatingDocumentShareLink] = useState(false);
  const [documentActionStatus, setDocumentActionStatus] = useState('');
  const [isSendingMeterReminders, setIsSendingMeterReminders] = useState(false);
  const [isLoadingReminderPreview, setIsLoadingReminderPreview] = useState(false);
  const [isReminderConfirmationOpen, setIsReminderConfirmationOpen] = useState(false);
  const [reminderPreview, setReminderPreview] = useState<ReminderPreviewPayload['preview']>();
  const [meterReminderStatus, setMeterReminderStatus] = useState('');
  const [storesError, setStoresError] = useState('');
  const [storeMeters, setStoreMeters] = useState<UtilityMeterPointRecord[]>([]);
  const [metersError, setMetersError] = useState('');
  const [metersStatus, setMetersStatus] = useState('');
  const [isLoadingMeters, setIsLoadingMeters] = useState(false);
  const [isCreatingMeter, setIsCreatingMeter] = useState(false);
  const [meterForm, setMeterForm] = useState<MeterFormState>(EMPTY_METER_FORM);
  const [editingMeterId, setEditingMeterId] = useState('');
  const [updatingMeterId, setUpdatingMeterId] = useState('');
  const [isMeterFormOpen, setIsMeterFormOpen] = useState(false);
  const [storeRates, setStoreRates] = useState<UtilityMeterRateView[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const reviewRequestId = useRef(0);
  const statisticsRequestId = useRef(0);

  const monthInputValue = useMemo(() => periodMonth.slice(0, 7), [periodMonth]);
  const activeStores = useMemo(() => stores.filter((store) => store.isActive), [stores]);
  const regions = useMemo(
    () => [...new Set(activeStores.map((store) => store.region.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'uk')),
    [activeStores]
  );
  const selectedStore = useMemo(
    () => activeStores.find((store) => store.id === selectedStoreId) ?? null,
    [activeStores, selectedStoreId]
  );
  const editingMeter = useMemo(
    () => storeMeters.find((meter) => meter.id === editingMeterId) ?? null,
    [storeMeters, editingMeterId]
  );
  const activeStoreMeters = useMemo(() => storeMeters.filter((meter) => meter.isActive), [storeMeters]);
  const hasConfiguredMeters = activeStoreMeters.length > 0;
  const hasRatesForSelectedPeriod = storeRates.length > 0;
  const missingReviewItems = useMemo(() => (payload.items ?? []).filter((item) => !item.reading), [payload.items]);

  async function loadStores() {
    try {
      const response = await fetch('/api/admin/utility-meters/stores', { cache: 'no-store' });
      const result = (await response.json()) as StoresPayload;
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося завантажити магазини.');
      setStores(result.stores ?? []);
    } catch (error) {
      setStoresError(error instanceof Error ? error.message : 'Не вдалося завантажити магазини.');
    }
  }

  async function loadReview(nextPeriod = periodMonth, nextStoreId = selectedStoreId) {
    const requestId = ++reviewRequestId.current;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ periodMonth: nextPeriod });
      if (nextStoreId) params.set('storeId', nextStoreId);
      const response = await fetch(`/api/admin/utility-meters/review?${params.toString()}`, {
        cache: 'no-store'
      });
      const nextPayload = (await response.json()) as ReviewPayload;
      if (requestId === reviewRequestId.current) setPayload(nextPayload);
    } catch (error) {
      if (requestId === reviewRequestId.current) setPayload({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити перевірку.' });
    } finally {
      if (requestId === reviewRequestId.current) setIsLoading(false);
    }
  }

  async function loadConsumptionStatistics(
    nextPeriodFrom = statisticsPeriodFrom,
    nextPeriodTo = statisticsPeriodTo,
    nextStoreIds = statisticsStoreIds,
    nextRegions = statisticsRegions
  ) {
    const requestId = ++statisticsRequestId.current;
    setIsLoadingStatistics(true);
    try {
      const params = new URLSearchParams({ periodFrom: nextPeriodFrom, periodTo: nextPeriodTo });
      nextStoreIds.forEach((storeId) => params.append('storeId', storeId));
      nextRegions.forEach((region) => params.append('region', region));
      const response = await fetch(`/api/admin/utility-meters/statistics?${params.toString()}`, { cache: 'no-store' });
      const result = (await response.json()) as ConsumptionStatisticsPayload;
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося завантажити статистику споживання.');
      if (requestId === statisticsRequestId.current) setStatisticsPayload(result);
    } catch (error) {
      if (requestId === statisticsRequestId.current) setStatisticsPayload({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити статистику споживання.' });
    } finally {
      if (requestId === statisticsRequestId.current) setIsLoadingStatistics(false);
    }
  }

  async function openConsumptionChart(meter: ConsumptionStatisticItem) {
    setSelectedChartMeter(meter);
    setChartPayload({});
    setIsLoadingChart(true);
    try {
      const params = new URLSearchParams({
        meterPointId: meter.id,
        periodFrom: statisticsPeriodFrom,
        periodTo: statisticsPeriodTo
      });
      const response = await fetch(`/api/admin/utility-meters/statistics/meter?${params.toString()}`, { cache: 'no-store' });
      const result = (await response.json()) as ConsumptionHistoryPayload;
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося завантажити історію споживання.');
      setChartPayload(result);
    } catch (error) {
      setChartPayload({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити історію споживання.' });
    } finally {
      setIsLoadingChart(false);
    }
  }

  async function loadStoreMeters(storeId: string) {
    if (!storeId) {
      setStoreMeters([]);
      setMetersError('');
      return;
    }

    setIsLoadingMeters(true);
    setMetersError('');
    try {
      const response = await fetch(`/api/admin/utility-meters/points?${new URLSearchParams({ storeId }).toString()}`, {
        cache: 'no-store'
      });
      const result = (await response.json()) as MeterPointsPayload;
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося завантажити лічильники магазину.');
      setStoreMeters(result.meters ?? []);
    } catch (error) {
      setStoreMeters([]);
      setMetersError(error instanceof Error ? error.message : 'Не вдалося завантажити лічильники магазину.');
    } finally {
      setIsLoadingMeters(false);
    }
  }

  async function loadStoreRates(storeId: string, nextPeriod = periodMonth) {
    if (!storeId) {
      setStoreRates([]);
      return;
    }

    setIsLoadingRates(true);
    try {
      const params = new URLSearchParams({ storeId, periodMonth: nextPeriod });
      const response = await fetch(`/api/admin/utility-meters/rates?${params.toString()}`, {
        cache: 'no-store'
      });
      const result = (await response.json()) as RatesPayload;
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося завантажити тарифи.');
      setStoreRates(result.rates ?? []);
    } catch {
      setStoreRates([]);
    } finally {
      setIsLoadingRates(false);
    }
  }

  useEffect(() => {
    void loadStores();
    void loadReview();
    void loadConsumptionStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleStatisticsValue(values: string[], value: string, setValues: (nextValues: string[]) => void) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function toggleStatisticsRegion(region: string) {
    const regionStoreIds = activeStores.filter((store) => store.region.trim() === region).map((store) => store.id);
    if (statisticsRegions.includes(region)) {
      setStatisticsRegions(statisticsRegions.filter((item) => item !== region));
      setStatisticsStoreIds(statisticsStoreIds.filter((storeId) => !regionStoreIds.includes(storeId)));
      return;
    }

    setStatisticsRegions([...statisticsRegions, region]);
    setStatisticsStoreIds([...new Set([...statisticsStoreIds, ...regionStoreIds])]);
  }

  function applyStatisticsFilters() {
    const configurationStoreId = statisticsStoreIds.length === 1 ? statisticsStoreIds[0] : '';
    setPeriodMonth(statisticsPeriodTo);
    setSelectedStoreId(configurationStoreId);
    setAccessLinkStatus('');
    setMetersStatus('');
    resetMeterEditor();
    void loadConsumptionStatistics();
    void loadReview(statisticsPeriodTo, configurationStoreId);
    void loadStoreMeters(configurationStoreId);
    void loadStoreRates(configurationStoreId, statisticsPeriodTo);
  }

  useEffect(() => {
    if (!selectedStoreId) {
      setStoreRates([]);
      return;
    }

    void loadStoreRates(selectedStoreId, periodMonth);
  }, [periodMonth, selectedStoreId]);

  function handleStoreChange(storeId: string) {
    setSelectedStoreId(storeId);
    setAccessLinkStatus('');
    setMetersStatus('');
    setEditingMeterId('');
    setMeterForm(EMPTY_METER_FORM);
    setIsMeterFormOpen(false);
    void loadReview(periodMonth, storeId);
    void loadStoreMeters(storeId);
    void loadStoreRates(storeId, periodMonth);
  }

  function startEditMeter(meter: UtilityMeterPointRecord) {
    setEditingMeterId(meter.id);
    setMeterForm(meterToFormState(meter));
    setMetersError('');
    setMetersStatus('');
    setIsMeterFormOpen(true);
  }

  function resetMeterEditor() {
    setEditingMeterId('');
    setMeterForm(EMPTY_METER_FORM);
    setIsMeterFormOpen(false);
  }

  async function saveMeter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStoreId) {
      setMetersStatus('Спочатку оберіть магазин.');
      return;
    }

    setIsCreatingMeter(true);
    setMetersError('');
    setMetersStatus('');

    try {
      const initialReadingRequested = Boolean(meterForm.initialReadingValue.trim());
      const initialReadingValue = initialReadingRequested ? parseUtilityMeterDecimal(meterForm.initialReadingValue) : undefined;
      if (initialReadingRequested && !Number.isFinite(initialReadingValue)) {
        throw new Error('Початковий показник має бути числом. Можна використовувати крапку, кому або пробіл між тисячами.');
      }
      const response = await fetch('/api/admin/utility-meters/points', {
        method: editingMeterId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingMeterId ? { meterPointId: editingMeterId, updateFields: true } : {}),
          ...(editingMeterId ? { isActive: editingMeter?.isActive ?? true } : {}),
          storeId: selectedStoreId,
          utilityType: meterForm.utilityType,
          utilityLabel: meterForm.utilityLabel,
          meterNumber: meterForm.meterNumber,
          coefficient: meterForm.coefficient ? Number(meterForm.coefficient.replace(',', '.')) : undefined,
          initialReadingRequested,
          initialReadingValue,
          initialReadingDate: initialReadingRequested ? meterForm.initialReadingDate : undefined,
          defaultRate: meterForm.defaultRate ? Number(meterForm.defaultRate.replace(',', '.')) : undefined,
          ownerKind: meterForm.ownerKind,
          tenantName: meterForm.tenantName,
          legalEntity: meterForm.legalEntity,
          providerName: meterForm.providerName,
          contractNumber: meterForm.contractNumber,
          areaSqM: meterForm.areaSqM ? Number(meterForm.areaSqM.replace(',', '.')) : undefined
        })
      });
      const result = (await response.json()) as MeterPointsPayload;
      const defaultSaveError = editingMeterId ? 'Не вдалося оновити лічильник.' : 'Не вдалося створити лічильник.';
      if (!response.ok || !result.ok) throw new Error(result.error || defaultSaveError);

      resetMeterEditor();
      setMetersStatus(
        editingMeterId
          ? 'Лічильник оновлено. Зміни вже доступні для внесення показників.'
          : 'Лічильник створено. Тепер він доступний для внесення показників.'
      );
      await Promise.all([loadStoreMeters(selectedStoreId), loadReview(periodMonth, selectedStoreId)]);
    } catch (error) {
      setMetersError(error instanceof Error ? error.message : 'Не вдалося створити лічильник.');
    } finally {
      setIsCreatingMeter(false);
    }
  }

  async function toggleMeterActiveState(meter: UtilityMeterPointRecord) {
    if (!selectedStoreId) return;

    setUpdatingMeterId(meter.id);
    setMetersError('');
    setMetersStatus('');
    try {
      const response = await fetch('/api/admin/utility-meters/points', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meterPointId: meter.id,
          storeId: selectedStoreId,
          isActive: !meter.isActive
        })
      });
      const result = (await response.json()) as MeterPointsPayload;
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося оновити стан лічильника.');

      if (editingMeterId === meter.id && meter.isActive) {
        resetMeterEditor();
      }

      setMetersStatus(!meter.isActive ? 'Лічильник активовано.' : 'Лічильник деактивовано.');
      await Promise.all([loadStoreMeters(selectedStoreId), loadReview(periodMonth, selectedStoreId)]);
    } catch (error) {
      setMetersError(error instanceof Error ? error.message : 'Не вдалося оновити стан лічильника.');
    } finally {
      setUpdatingMeterId('');
    }
  }

  async function openReadingsForm() {
    if (!selectedStoreId) {
      setAccessLinkStatus('Спочатку оберіть магазин.');
      return;
    }

    if (!hasConfiguredMeters) {
      setAccessLinkStatus('Спочатку додайте хоча б один активний лічильник для цього магазину.');
      return;
    }

    if (!hasRatesForSelectedPeriod) {
      setAccessLinkStatus(`Спочатку додайте тариф для вибраного періоду ${periodMonth.slice(0, 7)}.`);
      return;
    }

    setIsCreatingAccessLink(true);
    setAccessLinkStatus('');
    try {
      const response = await fetch('/api/admin/utility-meters/access-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: selectedStoreId })
      });
      const result = (await response.json()) as AccessLinkPayload;
      if (!response.ok || !result.ok || !result.url) {
        throw new Error(result.error || 'Не вдалося створити посилання для внесення показників.');
      }

      window.open(result.url, '_blank', 'noopener,noreferrer');
      setAccessLinkStatus(
        result.user?.name
          ? `Відкрито персональне посилання на форму внесення показників для ${result.user.name}.`
          : 'Відкрито персональне посилання на форму внесення показників.'
      );
    } catch (error) {
      setAccessLinkStatus(error instanceof Error ? error.message : 'Не вдалося створити посилання для внесення показників.');
    } finally {
      setIsCreatingAccessLink(false);
    }
  }

  async function copyDocumentShareLink() {
    setIsCreatingDocumentShareLink(true);
    setDocumentActionStatus('');

    try {
      const response = await fetch('/api/admin/utility-meters/document-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodMonth,
          audience: 'stores',
          ...(selectedStoreId ? { storeId: selectedStoreId } : {})
        })
      });
      const result = (await response.json()) as AccessLinkPayload;
      if (!response.ok || !result.ok || !result.url) {
        throw new Error(result.error || 'Не вдалося сформувати посилання для перегляду документа.');
      }

      await navigator.clipboard.writeText(result.url);
      setDocumentActionStatus('Посилання на документ скопійовано.');
    } catch (error) {
      setDocumentActionStatus(error instanceof Error ? error.message : 'Не вдалося сформувати посилання для перегляду документа.');
    } finally {
      setIsCreatingDocumentShareLink(false);
    }
  }

  async function sendMeterReminders() {
    setIsSendingMeterReminders(true);
    setMeterReminderStatus('');
    try {
      const response = await fetch('/api/admin/utility-meters/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodMonth })
      });
      const result = (await response.json()) as ReminderRunPayload;
      if (!response.ok || !result.ok || !result.result) {
        throw new Error(result.error || 'Не вдалося надіслати нагадування.');
      }

      const summary = result.result;
      setMeterReminderStatus(
        summary.notificationsSent > 0
          ? `Надіслано: ${summary.notificationsSent}. Лічильників без показника: ${summary.missingMeters}.`
          : summary.skippedAlreadySent > 0
            ? 'Нагадування для цих працівників уже надсилалися сьогодні.'
            : 'Немає керівників магазинів з активними лічильниками без показників.'
      );
    } catch (error) {
      setMeterReminderStatus(error instanceof Error ? error.message : 'Не вдалося надіслати нагадування.');
    } finally {
      setIsSendingMeterReminders(false);
    }
  }

  async function openReminderConfirmation() {
    setIsLoadingReminderPreview(true);
    setMeterReminderStatus('');
    setReminderPreview(undefined);
    try {
      const response = await fetch('/api/admin/utility-meters/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodMonth, preview: true })
      });
      const result = (await response.json()) as ReminderPreviewPayload;
      if (!response.ok || !result.ok || !result.preview) throw new Error(result.error || 'Не вдалося підготувати нагадування.');
      setReminderPreview(result.preview);
      setIsReminderConfirmationOpen(true);
    } catch (error) {
      setMeterReminderStatus(error instanceof Error ? error.message : 'Не вдалося підготувати нагадування.');
    } finally {
      setIsLoadingReminderPreview(false);
    }
  }

  async function confirmMeterReminders() {
    setIsReminderConfirmationOpen(false);
    await sendMeterReminders();
  }

  const documentHref = `/admin/utility-meters/document?${new URLSearchParams({
    periodMonth,
    audience: 'stores',
    ...(selectedStoreId ? { storeId: selectedStoreId } : {})
  }).toString()}`;
  const documentPdfHref = `/api/utility-meters/document-export?${new URLSearchParams({
    format: 'pdf',
    periodMonth,
    audience: 'stores',
    ...(selectedStoreId ? { storeId: selectedStoreId } : {})
  }).toString()}`;
  const documentExcelHref = `/api/utility-meters/document-export?${new URLSearchParams({
    format: 'xlsx',
    periodMonth,
    audience: 'stores',
    ...(selectedStoreId ? { storeId: selectedStoreId } : {})
  }).toString()}`;
  const ratesHref = `/admin/utility-meters/rates?${new URLSearchParams({
    ...(selectedStoreId ? { storeId: selectedStoreId } : {}),
    periodMonth
  }).toString()}`;
  const addMeterDisabled = !selectedStoreId;
  const addRateDisabled = !selectedStoreId || !hasConfiguredMeters;
  const addReadingsDisabled = !selectedStoreId || !hasConfiguredMeters || !hasRatesForSelectedPeriod || isCreatingAccessLink;
  const chartItems = chartPayload.items ?? [];
  const chartMaximum = Math.max(...chartItems.map((item) => item.consumption), 0);
  const chartScaleMaximum = chartMaximum || 1;
  const chartPointX = (index: number) => chartItems.length === 1 ? 320 : 60 + (index / (chartItems.length - 1)) * 560;
  const chartPointY = (value: number) => 210 - (value / chartScaleMaximum) * 170;
  const chartPoints = chartItems.map((item, index) => `${chartPointX(index)},${chartPointY(item.consumption)}`).join(' ');

  return (
    <main className="min-h-screen w-full bg-slate-50 px-3 py-4 text-slate-950 sm:px-4 sm:py-5 lg:px-5 xl:px-6">
      <div className="flex w-full max-w-none flex-col gap-4 lg:gap-5">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Комунальні нарахування</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Показники лічильників по магазинах</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Оберіть магазин, щоб бачити його лічильники, внесені показники, автоматичні перевірки та суму до оплати за період.
          </p>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <span className="text-sm font-semibold text-slate-700">Період</span>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <span>Від</span>
              <input
                type="month"
                value={statisticsPeriodFrom.slice(0, 7)}
                onChange={(event) => {
                  setStatisticsPeriodFrom(`${event.target.value}-01`);
                  setStatisticsPayload({});
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-base"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <span>До</span>
              <input
                type="month"
                value={statisticsPeriodTo.slice(0, 7)}
                onChange={(event) => {
                  setStatisticsPeriodTo(`${event.target.value}-01`);
                  setPayload({});
                  setStatisticsPayload({});
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-base"
              />
            </label>
              </div>

            <details className="relative min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700">
              <summary className="cursor-pointer font-semibold">Магазини та регіони: {statisticsStoreIds.length ? `обрано ${statisticsStoreIds.length}` : 'усі магазини'}</summary>
              <div className="absolute left-0 z-20 mt-3 w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <span className="font-semibold">Вибір магазинів</span>
                  <button type="button" onClick={() => { setStatisticsStoreIds([]); setStatisticsRegions([]); }} className="text-xs font-semibold text-amber-700 hover:underline">Скинути вибір</button>
                </div>
                {regions.length > 0 ? <div className="mt-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Регіони</div><div className="mt-1 grid gap-1 sm:grid-cols-2">{regions.map((region) => <label key={region} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50"><input type="checkbox" checked={statisticsRegions.includes(region)} onChange={() => toggleStatisticsRegion(region)} /><span>{region}</span></label>)}</div></div> : null}
                <div className="mt-3 max-h-60 overflow-y-auto border-t border-slate-200 pt-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Магазини</div>{activeStores.map((store) => <label key={store.id} className="mt-1 flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-slate-50"><input type="checkbox" checked={statisticsStoreIds.includes(store.id)} onChange={() => toggleStatisticsValue(statisticsStoreIds, store.id, setStatisticsStoreIds)} className="mt-0.5" /><span>{getStoreLabel(store)}{store.region ? <span className="text-slate-500"> · {store.region}</span> : null}</span></label>)}</div>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyStatisticsFilters}
              className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isLoadingStatistics}
            >
              {isLoadingStatistics ? 'Оновлення...' : 'Оновити'}
            </button>
            <button
              type="button"
              onClick={() => { void openReminderConfirmation(); }}
              disabled={isSendingMeterReminders || isLoadingReminderPreview}
              className="rounded-md bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isLoadingReminderPreview ? 'Перевірка...' : isSendingMeterReminders ? 'Надсилання...' : 'Нагадати про показники'}
            </button>
            </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Документи</span>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={documentHref}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
                target="_blank"
              >
                Переглянути документ
              </a>
              <a
                href={documentPdfHref}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
                target="_blank"
              >
                Завантажити PDF
              </a>
              <a
                href={documentExcelHref}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
              >
                Завантажити Excel
              </a>
              <button
                type="button"
                onClick={() => { void copyDocumentShareLink(); }}
                disabled={isCreatingDocumentShareLink}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-60"
              >
                {isCreatingDocumentShareLink ? 'Формування...' : 'Скопіювати посилання'}
              </button>
            </div>
            </div>
          </div>
          {documentActionStatus ? <div className="mt-2 text-sm font-medium text-slate-700">{documentActionStatus}</div> : null}
          {meterReminderStatus ? <div className="mt-2 text-sm font-medium text-slate-700">{meterReminderStatus}</div> : null}
        </section>

        {payload.totals ? (
          <UtilityMeterReviewTotals
            totals={payload.totals}
            isShowingMissing={isShowingMissingMeters}
            onToggleMissing={() => setIsShowingMissingMeters((current) => !current)}
          />
        ) : null}

        {isShowingMissingMeters ? (
          <section id="missing-meter-readings" className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm text-red-700">Потребують показників</div>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Не подано: {missingReviewItems.length}</h2>
                <p className="mt-1 text-sm text-slate-600">Лічильники без показань за {periodLabel(periodMonth)}.</p>
              </div>
              <button type="button" onClick={() => setIsShowingMissingMeters(false)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                Закрити список
              </button>
            </div>
            <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-[700px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                  <tr><th className="px-3 py-3">Магазин</th><th className="px-3 py-3">Лічильник</th><th className="px-3 py-3">Тип</th><th className="px-3 py-3">Дія</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {missingReviewItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-3 align-top"><div className="font-semibold">{item.storeCode || item.storeLabel || '—'}</div><div className="text-xs text-slate-500">{item.addressLine}</div></td>
                      <td className="px-3 py-3 align-top"><div className="font-medium">{item.utilityLabel}</div><div className="text-xs text-slate-500">{item.meterNumber || 'Без номера'}</div></td>
                      <td className="px-3 py-3 align-top"><span className={`rounded px-2 py-1 text-xs font-semibold ${utilityTypeBadge(item.utilityType).className}`}>{utilityTypeBadge(item.utilityType).label}</span></td>
                      <td className="px-3 py-3 align-top"><Link href={`/admin/utility-meters/meters/${encodeURIComponent(item.id)}?${new URLSearchParams({ ...(item.storeId ? { storeId: item.storeId } : {}), periodMonth }).toString()}`} className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-amber-400 hover:text-amber-800">Внести показник</Link></td>
                    </tr>
                  ))}
                  {!isLoading && missingReviewItems.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">Усі лічильники мають показання за цей період.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {storesError ? (
          <div className="rounded-lg bg-amber-50 p-4 text-sm font-medium text-amber-900 ring-1 ring-amber-200">{storesError}</div>
        ) : null}

        {payload.error ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">{payload.error}</div>
        ) : null}

        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="hidden flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">Аналітика</div>
              <h2 className="mt-1 text-xl font-bold">Статистика споживання</h2>
              <p className="mt-1 text-sm text-slate-600">Оберіть довільний діапазон місяців та одну або кілька груп магазинів.</p>
            </div>
            <button
              type="button"
              onClick={() => { void loadConsumptionStatistics(); }}
              disabled={isLoadingStatistics}
              className="hidden rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isLoadingStatistics ? 'Оновлення...' : 'Показати статистику'}
            </button>
          </div>

          <div className="mt-4 hidden grid gap-3 lg:grid-cols-4">
            <label className="block text-sm font-semibold text-slate-700">
              Від
              <input
                type="month"
                value={statisticsPeriodFrom.slice(0, 7)}
                onChange={(event) => setStatisticsPeriodFrom(`${event.target.value}-01`)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              До
              <input
                type="month"
                value={statisticsPeriodTo.slice(0, 7)}
                onChange={(event) => setStatisticsPeriodTo(`${event.target.value}-01`)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              />
            </label>
            <details className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 lg:col-span-2">
              <summary className="cursor-pointer font-semibold">Магазини: {statisticsStoreIds.length ? `обрано ${statisticsStoreIds.length}` : 'усі'}</summary>
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                <button type="button" onClick={() => setStatisticsStoreIds([])} className="text-xs font-semibold text-amber-700 hover:underline">Очистити вибір (усі магазини)</button>
                {activeStores.map((store) => (
                  <label key={store.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={statisticsStoreIds.includes(store.id)}
                      onChange={() => toggleStatisticsValue(statisticsStoreIds, store.id, setStatisticsStoreIds)}
                      className="mt-0.5"
                    />
                    <span>{getStoreLabel(store)}{store.region ? <span className="text-slate-500"> · {store.region}</span> : null}</span>
                  </label>
                ))}
              </div>
            </details>
            <details className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 lg:col-span-2">
              <summary className="cursor-pointer font-semibold">Регіони: {statisticsRegions.length ? `обрано ${statisticsRegions.length}` : 'усі'}</summary>
              <div className="mt-3 space-y-2">
                <button type="button" onClick={() => setStatisticsRegions([])} className="text-xs font-semibold text-amber-700 hover:underline">Очистити вибір (усі регіони)</button>
                {regions.map((region) => (
                  <label key={region} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={statisticsRegions.includes(region)}
                      onChange={() => toggleStatisticsValue(statisticsRegions, region, setStatisticsRegions)}
                    />
                    <span>{region}</span>
                  </label>
                ))}
              </div>
            </details>
            <div className="flex items-end lg:col-span-2">
              <button
                type="button"
                onClick={() => {
                  setStatisticsStoreIds([]);
                  setStatisticsRegions([]);
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              >
                Скинути фільтри
              </button>
            </div>
          </div>

          {statisticsPayload.error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">{statisticsPayload.error}</div> : null}
          {statisticsPayload.totals ? (
            <>
              <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-[840px] w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-3 py-3">Регіон / магазин</th><th className="px-3 py-3">Лічильник</th><th className="px-3 py-3">Періодів</th><th className="px-3 py-3">Споживання</th><th className="px-3 py-3">Сума</th><th className="px-3 py-3">Графік</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {(statisticsPayload.items ?? []).map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3 align-top"><div className="font-semibold">{item.storeCode || item.storeLabel || '—'}</div><div className="text-xs text-slate-500">{[item.region, item.city, item.addressLine].filter(Boolean).join(' · ')}</div></td>
                        <td className="px-3 py-3 align-top"><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-1 text-xs font-semibold ${utilityTypeBadge(item.utilityType).className}`}>{utilityTypeBadge(item.utilityType).label}</span><Link href={`/admin/utility-meters/meters/${encodeURIComponent(item.id)}?${new URLSearchParams({ ...(item.storeId ? { storeId: item.storeId } : {}), periodMonth: statisticsPeriodTo }).toString()}`} className="font-medium text-slate-950 hover:text-amber-700 hover:underline">{item.utilityLabel}</Link></div><div className="mt-1 text-xs text-slate-500">{item.meterNumber || 'Без номера'}</div></td>
                        <td className="px-3 py-3 align-top">{item.readings}</td>
                        <td className="px-3 py-3 align-top">{number(item.consumption)}</td>
                        <td className="px-3 py-3 align-top">{money(item.amount)}</td>
                        <td className="px-3 py-3 align-top"><button type="button" onClick={() => { void openConsumptionChart(item); }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50">Відкрити</button></td>
                      </tr>
                    ))}
                    {!isLoadingStatistics && (statisticsPayload.items ?? []).length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">За вибраними фільтрами немає розрахованого споживання.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>

        <div className="flex min-w-0 w-full flex-col gap-5">
            {selectedStore ? (
            <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-500">Налаштування магазину</div>
                  <div className="mt-1 text-xl font-bold">Власні лічильники магазину</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Для налаштування лічильників оберіть рівно один магазин у верхньому фільтрі. Після створення вони одразу будуть доступні у формі внесення показників.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMeterId('');
                      setMeterForm(EMPTY_METER_FORM);
                      setMetersError('');
                      setMetersStatus('');
                      setIsMeterFormOpen(true);
                    }}
                    disabled={addMeterDisabled}
                    className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    1. Додати лічильник
                  </button>
                  <a
                    href={addRateDisabled ? undefined : ratesHref}
                    aria-disabled={addRateDisabled}
                    onClick={(event) => {
                      if (addRateDisabled) {
                        event.preventDefault();
                      }
                    }}
                    className={`rounded-md px-3 py-2 text-sm font-semibold ${
                      addRateDisabled
                        ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                        : 'border border-slate-300 bg-white text-slate-900'
                    }`}
                  >
                    2. Тарифи лічильників
                  </a>
                  <button
                    type="button"
                    onClick={() => { if (selectedStoreId) void loadStoreMeters(selectedStoreId); }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                    disabled={!selectedStoreId}
                  >
                    Оновити лічильники
                  </button>
                  <button
                    type="button"
                    onClick={() => { void openReadingsForm(); }}
                    className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={addReadingsDisabled}
                  >
                    {isCreatingAccessLink ? 'Створення...' : '3. Додати показники'}
                  </button>
                </div>
              </div>

              {!selectedStore ? (
                <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
                  Оберіть рівно один магазин у верхньому фільтрі, щоб створити або змінити його лічильники.
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-5">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="font-semibold text-slate-900">Порядок дій</div>
                    <div className="mt-1">
                      1. Створіть лічильник. 2. Додайте тариф для періоду {periodMonth.slice(0, 7)}. 3. Після цього відкривайте форму внесення показників.
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <span className={hasConfiguredMeters ? 'font-semibold text-green-700' : 'font-semibold text-amber-700'}>
                        Крок 1: {hasConfiguredMeters ? 'виконано' : 'очікує'}
                      </span>
                      <span className={hasRatesForSelectedPeriod ? 'font-semibold text-green-700' : 'font-semibold text-amber-700'}>
                        Крок 2: {hasRatesForSelectedPeriod ? 'виконано' : isLoadingRates ? 'перевірка...' : 'очікує'}
                      </span>
                      <span className={!addReadingsDisabled ? 'font-semibold text-green-700' : 'font-semibold text-slate-500'}>
                        Крок 3: {!addReadingsDisabled ? 'доступний' : 'заблоковано'}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    {metersError ? (
                      <div className="mb-3 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">{metersError}</div>
                    ) : null}
                    {metersStatus ? (
                      <div className="mb-3 rounded-md bg-green-50 p-3 text-sm font-medium text-green-800 ring-1 ring-green-200">{metersStatus}</div>
                    ) : null}
                    {accessLinkStatus ? (
                      <div className="mb-3 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200">{accessLinkStatus}</div>
                    ) : null}

                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="min-w-[760px] divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                            <tr>
                              <th className="px-3 py-3">Лічильник</th>
                              <th className="px-3 py-3">Тип</th>
                              <th className="px-3 py-3">Власник</th>
                              <th className="px-3 py-3">Коеф.</th>
                              <th className="px-3 py-3">Стан</th>
                              <th className="px-3 py-3">Дії</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {storeMeters.map((meter) => {
                              const typeLabel = UTILITY_TYPE_OPTIONS.find((opt) => opt.value === meter.utilityType)?.label ?? meter.utilityType;
                              return (
                                <tr key={meter.id} className={meter.isActive ? '' : 'opacity-60'}>
                                  <td className="px-3 py-3 align-top">
                                    <Link
                                      href={`/admin/utility-meters/meters/${meter.id}`}
                                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                                    >
                                      {meter.utilityLabel}
                                    </Link>
                                    <div className="text-xs text-slate-500">{meter.meterNumber || 'Без номера'}</div>
                                  </td>
                                  <td className="px-3 py-3 align-top text-slate-700">{typeLabel}</td>
                                  <td className="px-3 py-3 align-top text-slate-700">
                                    {getMeterOwnerLabel(meter)}
                                  </td>
                                  <td className="px-3 py-3 align-top text-slate-700">{meter.coefficient}</td>
                                  <td className="px-3 py-3 align-top">
                                    <span className={`rounded px-2 py-1 text-xs font-semibold ${meter.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                                      {meter.isActive ? 'Активний' : 'Вимкнений'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 align-top">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => startEditMeter(meter)}
                                        disabled={updatingMeterId === meter.id}
                                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-50"
                                      >
                                        Редагувати
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { void toggleMeterActiveState(meter); }}
                                        disabled={updatingMeterId === meter.id}
                                        className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                      >
                                        {updatingMeterId === meter.id ? '...' : meter.isActive ? 'Вимкнути' : 'Увімкнути'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {isLoadingMeters ? (
                              <tr>
                                <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>Завантаження...</td>
                              </tr>
                            ) : null}
                            {!isLoadingMeters && storeMeters.length === 0 ? (
                              <tr>
                                <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>Для цього магазину ще немає власних лічильників.</td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {isMeterFormOpen ? (
                    <form onSubmit={saveMeter} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                        <span>{editingMeterId ? 'Редагування лічильника' : 'Створення нового лічильника'}</span>
                        <button
                          type="button"
                          onClick={resetMeterEditor}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                        >
                          Скасувати
                        </button>
                      </div>
                      <div className="text-sm font-semibold text-slate-700">
                        {editingMeterId ? 'Лічильник магазину' : 'Новий лічильник для'} {getStoreLabel(selectedStore)}
                      </div>

                      <div className="mt-4 grid gap-3">
                        <label className="block text-sm font-semibold text-slate-700">
                          Тип комунальної послуги
                          <select
                            value={meterForm.utilityType}
                            onChange={(event) => setMeterForm((current) => ({ ...current, utilityType: event.target.value as UtilityType }))}
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                          >
                            {UTILITY_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-sm font-semibold text-slate-700">
                          Назва лічильника
                          <input
                            value={meterForm.utilityLabel}
                            onChange={(event) => setMeterForm((current) => ({ ...current, utilityLabel: event.target.value }))}
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                            placeholder="Наприклад: Основний електролічильник"
                            required
                          />
                        </label>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="block text-sm font-semibold text-slate-700">
                            Номер лічильника
                            <input
                              value={meterForm.meterNumber}
                              onChange={(event) => setMeterForm((current) => ({ ...current, meterNumber: event.target.value }))}
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                              placeholder="Необов'язково"
                            />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700">
                            Коефіцієнт
                            <input
                              inputMode="decimal"
                              value={meterForm.coefficient}
                              onChange={(event) => setMeterForm((current) => ({ ...current, coefficient: event.target.value }))}
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                              required
                            />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700">
                            Початковий показник
                            <input
                              inputMode="decimal"
                              value={meterForm.initialReadingValue}
                              onChange={(event) => setMeterForm((current) => ({ ...current, initialReadingValue: event.target.value }))}
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                              placeholder="Необов'язково"
                            />
                          </label>
                        </div>

                        {meterForm.initialReadingValue ? (
                          <label className="block text-sm font-semibold text-slate-700">
                            Дата початкового показника
                            <input
                              type="date"
                              value={meterForm.initialReadingDate}
                              onChange={(event) => setMeterForm((current) => ({ ...current, initialReadingDate: event.target.value }))}
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                              required
                            />
                            <span className="mt-1 block text-xs font-normal text-slate-500">
                              Буде автоматично записано як перший показник для цього лічильника.
                            </span>
                          </label>
                        ) : null}

                        <label className="block text-sm font-semibold text-slate-700">
                          Тариф (ціна за одиницю), грн
                          <input
                            inputMode="decimal"
                            value={meterForm.defaultRate}
                            onChange={(event) => setMeterForm((current) => ({ ...current, defaultRate: event.target.value }))}
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                            placeholder="Необов'язково"
                          />
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            Використовується для розрахунку суми нарахування. Можна змінити пізніше.
                          </span>
                        </label>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-semibold text-slate-700">
                            Хто використовує
                            <select
                              value={meterForm.ownerKind}
                              onChange={(event) => setMeterForm((current) => ({ ...current, ownerKind: event.target.value as UtilityMeterOwnerKind }))}
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                            >
                              {OWNER_KIND_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm font-semibold text-slate-700">
                            Орендар
                            <input
                              value={meterForm.tenantName}
                              onChange={(event) => setMeterForm((current) => ({ ...current, tenantName: event.target.value }))}
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                              placeholder="Заповніть, якщо це лічильник орендаря"
                            />
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-semibold text-slate-700">
                            Постачальник
                            <input
                              value={meterForm.providerName}
                              onChange={(event) => setMeterForm((current) => ({ ...current, providerName: event.target.value }))}
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                            />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700">
                            Номер договору
                            <input
                              value={meterForm.contractNumber}
                              onChange={(event) => setMeterForm((current) => ({ ...current, contractNumber: event.target.value }))}
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                            />
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-semibold text-slate-700">
                            Юридична особа
                            <input
                              value={meterForm.legalEntity}
                              onChange={(event) => setMeterForm((current) => ({ ...current, legalEntity: event.target.value }))}
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                            />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700">
                            Площа, м2
                            <input
                              inputMode="decimal"
                              value={meterForm.areaSqM}
                              onChange={(event) => setMeterForm((current) => ({ ...current, areaSqM: event.target.value }))}
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                            />
                          </label>
                        </div>
                      </div>

                      {metersError ? (
                        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">{metersError}</div>
                      ) : null}

                      <button
                        type="submit"
                        disabled={isCreatingMeter}
                        className="mt-4 w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCreatingMeter ? 'Збереження...' : editingMeterId ? 'Зберегти зміни' : 'Створити лічильник'}
                      </button>
                    </form>
                  ) : null}
                </div>
              )}
            </section>
            ) : null}

            <section className="hidden rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm text-slate-500">Поточний перегляд</div>
              <div className="mt-1 text-xl font-bold">{selectedStore ? getStoreLabel(selectedStore) : 'Усі магазини'}</div>
              {selectedStore ? <div className="mt-1 text-sm text-slate-600">{selectedStore.city}, {selectedStore.addressLine}</div> : null}
            </section>

            {payload.totals ? (
              <section className="hidden order-first grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-sm text-slate-500">Лічильники</div>
                  <div className="text-2xl font-bold">{payload.totals.meters}</div>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-sm text-slate-500">Подано</div>
                  <div className="text-2xl font-bold">{payload.totals.submitted}</div>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-sm text-slate-500">Ок</div>
                  <div className="text-2xl font-bold text-green-700">{payload.totals.ok}</div>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-sm text-slate-500">Зауваження</div>
                  <div className="text-2xl font-bold text-amber-700">{payload.totals.warning + payload.totals.error}</div>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-sm text-slate-500">Сума</div>
                  <div className="text-2xl font-bold">{money(payload.totals.amount)}</div>
                </div>
              </section>
            ) : null}

            <section className="hidden w-full overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              <div className="w-full overflow-x-auto" tabIndex={0} aria-label="Таблиця показників лічильників. Прокрутіть горизонтально, щоб побачити всі колонки.">
                <table className="w-full min-w-0 divide-y divide-slate-200 text-sm 2xl:min-w-[880px]">
                  <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-3">Магазин</th>
                      <th className="px-3 py-3">Лічильник</th>
                      <th className="hidden px-3 py-3 2xl:table-cell">Власник</th>
                      <th className="px-3 py-3">Показник</th>
                      <th className="px-3 py-3">Споживання</th>
                      <th className="px-3 py-3">Сума</th>
                      <th className="px-3 py-3">Перевірка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(payload.items ?? []).map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3 align-top">
                          <div className="font-semibold">{item.storeCode || item.storeLabel || '—'}</div>
                          <div className="text-xs text-slate-500">{item.addressLine}</div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Link
                            href={`/admin/utility-meters/meters/${encodeURIComponent(item.id)}?${new URLSearchParams({
                              ...(selectedStoreId ? { storeId: selectedStoreId } : {}),
                              periodMonth
                            }).toString()}`}
                            className="block rounded-sm hover:text-amber-700 hover:underline"
                          >
                            <div className="font-medium">{item.utilityLabel}</div>
                            <div className="text-xs text-slate-500">{item.meterNumber || 'Без номера'}</div>
                          </Link>
                        </td>
                        <td className="hidden px-3 py-3 align-top 2xl:table-cell">{getMeterOwnerLabel(item)}</td>
                        <td className="px-3 py-3 align-top">{item.reading ? item.reading.readingValue : 'Не подано'}</td>
                        <td className="px-3 py-3 align-top">{item.charge?.consumption ?? '—'}</td>
                        <td className="px-3 py-3 align-top">{money(item.charge?.amount)}</td>
                        <td className="px-3 py-3 align-top">
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
                        </td>
                      </tr>
                    ))}
                    {!isLoading && (payload.items ?? []).length === 0 ? (
                      <tr>
                        <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={7}>
                          Для вибраного магазину ще немає налаштованих лічильників або показників за цей період.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
        </div>
      </div>
      {isReminderConfirmationOpen && reminderPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="meter-reminder-confirmation-title" onMouseDown={() => setIsReminderConfirmationOpen(false)}>
          <section className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Нагадування</p>
            <h2 id="meter-reminder-confirmation-title" className="mt-1 text-xl font-bold text-slate-950">Підтвердити надсилання?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">За {periodLabel(reminderPreview.periodMonth)} буде надіслано нагадування <span className="font-semibold text-slate-950">{reminderPreview.storesToNotify} магазинам</span> щодо <span className="font-semibold text-slate-950">{reminderPreview.missingMeters} лічильників</span>.</p>
            {reminderPreview.candidates === 0 ? <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">Усі показники вже внесені або нагадування цим магазинам уже надсилалися сьогодні.</div> : null}
            {reminderPreview.skippedAlreadySent > 0 ? <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Не буде повторно надіслано: {reminderPreview.skippedAlreadySent} отримувачам, яким уже нагадували сьогодні.</div> : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setIsReminderConfirmationOpen(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Скасувати</button>
              <button type="button" onClick={() => { void confirmMeterReminders(); }} disabled={reminderPreview.candidates === 0 || isSendingMeterReminders} className="rounded-md bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Підтвердити надсилання</button>
            </div>
          </section>
        </div>
      ) : null}
      {selectedChartMeter ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="meter-consumption-chart-title" onMouseDown={() => setSelectedChartMeter(null)}>
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Споживання за період {periodLabel(statisticsPeriodFrom)} — {periodLabel(statisticsPeriodTo)}</p>
                <h2 id="meter-consumption-chart-title" className="mt-1 text-xl font-bold">{selectedChartMeter.utilityLabel}</h2>
                <p className="mt-1 text-sm text-slate-600">{[selectedChartMeter.storeCode || selectedChartMeter.storeLabel, selectedChartMeter.region, selectedChartMeter.city].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={() => setSelectedChartMeter(null)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800">Закрити</button>
            </div>
            {isLoadingChart ? <div className="py-16 text-center text-slate-500">Завантаження графіка...</div> : null}
            {chartPayload.error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800">{chartPayload.error}</div> : null}
            {!isLoadingChart && !chartPayload.error && chartItems.length === 0 ? <div className="mt-6 rounded-md bg-slate-50 p-6 text-center text-sm text-slate-600">За вибраний період для цього лічильника немає розрахованого споживання.</div> : null}
            {!isLoadingChart && chartItems.length > 0 ? (
              <div className="mt-5">
                <div className="mb-3 grid gap-3 sm:grid-cols-2"><div className="rounded-md bg-slate-50 p-3"><div className="text-sm text-slate-500">Усього спожито</div><div className="text-xl font-bold">{number(chartItems.reduce((sum, item) => sum + item.consumption, 0))}</div></div><div className="rounded-md bg-slate-50 p-3"><div className="text-sm text-slate-500">Усього нараховано</div><div className="text-xl font-bold">{money(chartItems.reduce((sum, item) => sum + item.amount, 0))}</div></div></div>
                <svg viewBox="0 0 640 260" className="h-auto w-full" role="img" aria-label="Графік помісячного споживання лічильника">
                  <line x1="60" x2="620" y1="40" y2="40" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1="60" x2="620" y1="125" y2="125" stroke="#e2e8f0" strokeWidth="1" />
                  <line x1="60" x2="620" y1="210" y2="210" stroke="#94a3b8" strokeWidth="1" />
                  <text x="54" y="44" textAnchor="end" fontSize="11" fill="#475569">{number(chartMaximum)}</text>
                  <text x="54" y="129" textAnchor="end" fontSize="11" fill="#475569">{number(chartMaximum / 2)}</text>
                  <text x="54" y="214" textAnchor="end" fontSize="11" fill="#475569">0</text>
                  <polyline points={chartPoints} fill="none" stroke="#d97706" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  {chartItems.map((item, index) => <g key={item.periodMonth}><circle cx={chartPointX(index)} cy={chartPointY(item.consumption)} r="4" fill="#d97706"><title>{periodLabel(item.periodMonth)}: {number(item.consumption)}</title></circle>{(index === 0 || index === chartItems.length - 1 || (chartItems.length <= 6)) ? <text x={chartPointX(index)} y="234" textAnchor="middle" fontSize="11" fill="#475569">{periodLabel(item.periodMonth)}</text> : null}</g>)}
                  <text x="60" y="18" fontSize="12" fill="#334155">Споживання</text>
                </svg>
                <div className="mt-3 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-600"><tr><th className="px-3 py-2">Місяць</th><th className="px-3 py-2">Споживання</th><th className="px-3 py-2">Сума</th></tr></thead><tbody>{chartItems.map((item) => <tr key={item.periodMonth} className="divide-x-0 border-b border-slate-100"><td className="px-3 py-2">{periodLabel(item.periodMonth)}</td><td className="px-3 py-2">{number(item.consumption)}</td><td className="px-3 py-2">{money(item.amount)}</td></tr>)}</tbody></table></div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
