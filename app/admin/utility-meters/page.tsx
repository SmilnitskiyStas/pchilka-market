'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type {
  UtilityMeterOwnerKind,
  UtilityMeterPointRecord,
  UtilityMeterReviewItem,
  UtilityType
} from '@/lib/utility-metering-types';

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

type MeterMappingGroup = {
  key: string;
  meterPointIds: string[];
  sourceStoreCode: string;
  storeLabel: string;
  addressLine: string;
  meterCount: number;
  readingCount: number;
  assignedStoreId: string;
  assignedStoreLabel: string;
};

type MeterMappingsPayload = {
  ok?: boolean;
  groups?: MeterMappingGroup[];
  error?: string;
};

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
    initialReadingDate: todayIso(),
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

function getStoreLabel(store: StoreView) {
  return [store.storeCode, store.name || store.addressLine].filter(Boolean).join(' · ') || `Магазин #${store.id}`;
}

export default function AdminUtilityMetersPage() {
  const [periodMonth, setPeriodMonth] = useState(currentPeriodMonth());
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [stores, setStores] = useState<StoreView[]>([]);
  const [payload, setPayload] = useState<ReviewPayload>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingAccessLink, setIsCreatingAccessLink] = useState(false);
  const [accessLinkStatus, setAccessLinkStatus] = useState('');
  const [isCreatingDocumentShareLink, setIsCreatingDocumentShareLink] = useState(false);
  const [documentActionStatus, setDocumentActionStatus] = useState('');
  const [storesError, setStoresError] = useState('');
  const [mappingGroups, setMappingGroups] = useState<MeterMappingGroup[]>([]);
  const [mappingSelections, setMappingSelections] = useState<Record<string, string>>({});
  const [mappingError, setMappingError] = useState('');
  const [mappingStatus, setMappingStatus] = useState('');
  const [savingMappingKey, setSavingMappingKey] = useState('');
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

  const monthInputValue = useMemo(() => periodMonth.slice(0, 7), [periodMonth]);
  const activeStores = useMemo(() => stores.filter((store) => store.isActive), [stores]);
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
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ periodMonth: nextPeriod });
      if (nextStoreId) params.set('storeId', nextStoreId);
      const response = await fetch(`/api/admin/utility-meters/review?${params.toString()}`, {
        cache: 'no-store'
      });
      const nextPayload = (await response.json()) as ReviewPayload;
      setPayload(nextPayload);
    } catch (error) {
      setPayload({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити перевірку.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMappings() {
    setMappingError('');
    try {
      const response = await fetch('/api/admin/utility-meters/mappings', { cache: 'no-store' });
      const result = (await response.json()) as MeterMappingsPayload;
      if (!response.ok || !result.ok) throw new Error(result.error || "Не вдалося завантажити прив'язки лічильників.");
      const groups = result.groups ?? [];
      setMappingGroups(groups);
      setMappingSelections(Object.fromEntries(groups.map((group) => [group.key, group.assignedStoreId])));
    } catch (error) {
      setMappingError(error instanceof Error ? error.message : "Не вдалося завантажити прив'язки лічильників.");
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
    void loadMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedStoreId) {
      setStoreRates([]);
      return;
    }

    void loadStoreRates(selectedStoreId, periodMonth);
  }, [periodMonth, selectedStoreId]);

  async function saveMapping(group: MeterMappingGroup) {
    const storeId = mappingSelections[group.key] ?? '';
    setSavingMappingKey(group.key);
    setMappingError('');
    setMappingStatus('');
    try {
      const response = await fetch('/api/admin/utility-meters/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meterPointIds: group.meterPointIds, storeId: storeId || null })
      });
      const result = (await response.json()) as { ok?: boolean; updated?: number; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Не вдалося зберегти прив'язку.");
      setMappingStatus(
        storeId
          ? `Прив'язано лічильників: ${result.updated ?? group.meterCount}.`
          : `Відв'язано лічильників: ${result.updated ?? group.meterCount}.`
      );
      await Promise.all([loadMappings(), loadReview(periodMonth, selectedStoreId)]);
    } catch (error) {
      setMappingError(error instanceof Error ? error.message : "Не вдалося зберегти прив'язку.");
    } finally {
      setSavingMappingKey('');
    }
  }

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
          initialReadingValue: meterForm.initialReadingValue
            ? Number(meterForm.initialReadingValue.replace(',', '.'))
            : undefined,
          initialReadingDate: meterForm.initialReadingValue ? meterForm.initialReadingDate : undefined,
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

  const documentHref = `/admin/utility-meters/document?${new URLSearchParams({
    periodMonth,
    ...(selectedStoreId ? { storeId: selectedStoreId } : {})
  }).toString()}`;
  const documentPdfHref = `/api/utility-meters/document-export?${new URLSearchParams({
    format: 'pdf',
    periodMonth,
    ...(selectedStoreId ? { storeId: selectedStoreId } : {})
  }).toString()}`;
  const documentExcelHref = `/api/utility-meters/document-export?${new URLSearchParams({
    format: 'xlsx',
    periodMonth,
    ...(selectedStoreId ? { storeId: selectedStoreId } : {})
  }).toString()}`;
  const ratesHref = `/admin/utility-meters/rates?${new URLSearchParams({
    ...(selectedStoreId ? { storeId: selectedStoreId } : {}),
    periodMonth
  }).toString()}`;
  const addMeterDisabled = !selectedStoreId;
  const addRateDisabled = !selectedStoreId || !hasConfiguredMeters;
  const addReadingsDisabled = !selectedStoreId || !hasConfiguredMeters || !hasRatesForSelectedPeriod || isCreatingAccessLink;

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="flex w-full max-w-none flex-col gap-5">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Комунальні нарахування</p>
          <h1 className="mt-1 text-3xl font-bold">Показники лічильників по магазинах</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Оберіть магазин, щоб бачити його лічильники, внесені показники, автоматичні перевірки та суму до оплати за період.
          </p>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              Період
              <input
                type="month"
                value={monthInputValue}
                onChange={(event) => {
                  const nextPeriod = `${event.target.value}-01`;
                  setPeriodMonth(nextPeriod);
                  void loadReview(nextPeriod, selectedStoreId);
                }}
                className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-base"
              />
            </label>

            <label className="block min-w-72 text-sm font-semibold text-slate-700">
              Магазин
              <select
                value={selectedStoreId}
                onChange={(event) => handleStoreChange(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              >
                <option value="">Усі магазини</option>
                {activeStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {getStoreLabel(store)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => loadReview(periodMonth, selectedStoreId)}
              className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? 'Оновлення...' : 'Оновити'}
            </button>
            <a
              href={`/admin/utility-meters/rates?${new URLSearchParams({
                ...(selectedStoreId ? { storeId: selectedStoreId } : {}),
                periodMonth
              }).toString()}`}
              className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
            >
              Тарифи
            </a>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={documentHref}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
                target="_blank"
              >
                Документ на оплату
              </a>
              <a
                href={documentPdfHref}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
                target="_blank"
              >
                PDF
              </a>
              <a
                href={documentExcelHref}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
              >
                Excel
              </a>
              <button
                type="button"
                onClick={() => { void copyDocumentShareLink(); }}
                disabled={isCreatingDocumentShareLink}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-60"
              >
                {isCreatingDocumentShareLink ? 'Формування...' : 'Посилання'}
              </button>
            </div>
          </div>
          {documentActionStatus ? <div className="mt-2 text-sm font-medium text-slate-700">{documentActionStatus}</div> : null}
        </section>

        {storesError ? (
          <div className="rounded-lg bg-amber-50 p-4 text-sm font-medium text-amber-900 ring-1 ring-amber-200">{storesError}</div>
        ) : null}

        {payload.error ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">{payload.error}</div>
        ) : null}

        <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-lg font-bold">Прив'язка імпортованих лічильників</h2>
              <p className="mt-1 text-sm text-slate-600">
                Звірте вихідний код та адресу з Excel, потім виберіть відповідний магазин.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a href="/admin/network" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
                Додати магазини
              </a>
              <button
                type="button"
                onClick={() => { void loadMappings(); }}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              >
                Оновити список
              </button>
            </div>
          </div>
          {mappingError ? <div className="bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{mappingError}</div> : null}
          {mappingStatus ? <div className="bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{mappingStatus}</div> : null}
          <div className="max-h-[440px] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">Дані з Excel</th>
                  <th className="px-3 py-3">Обсяг</th>
                  <th className="min-w-72 px-3 py-3">Магазин у системі</th>
                  <th className="px-3 py-3">Дія</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mappingGroups.map((group) => {
                  const selection = mappingSelections[group.key] ?? '';
                  const isSaving = savingMappingKey === group.key;
                  return (
                    <tr key={group.key}>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold">{group.sourceStoreCode || group.storeLabel || 'Без коду'}</div>
                        {group.storeLabel && group.storeLabel !== group.sourceStoreCode ? (
                          <div className="mt-1 text-xs text-slate-600">{group.storeLabel}</div>
                        ) : null}
                        <div className="mt-1 text-xs text-slate-500">{group.addressLine || 'Адресу в Excel не вказано'}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-slate-700">
                        <div>{group.meterCount} ліч.</div>
                        <div className="text-xs text-slate-500">{group.readingCount} показ.</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <select
                          value={selection}
                          onChange={(event) =>
                            setMappingSelections((current) => ({ ...current, [group.key]: event.target.value }))
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Не прив'язано</option>
                          {activeStores.map((store) => (
                            <option key={store.id} value={store.id}>
                              {[store.storeCode, store.city, store.addressLine].filter(Boolean).join(' | ')}
                            </option>
                          ))}
                        </select>
                        {group.assignedStoreLabel ? (
                          <div className="mt-1 text-xs text-slate-500">Зараз: {group.assignedStoreLabel}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => { void saveMapping(group); }}
                          disabled={isSaving || selection === group.assignedStoreId}
                          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isSaving ? 'Збереження...' : selection ? "Прив'язати" : "Відв'язати"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {mappingGroups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500">Імпортованих лічильників немає.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid w-full gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="px-2 pb-2 text-sm font-semibold text-slate-700">Магазини</div>
            <div className="max-h-[640px] space-y-1 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => handleStoreChange('')}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  selectedStoreId === '' ? 'bg-amber-100 font-semibold text-slate-950' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Усі магазини
              </button>
              {activeStores.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => handleStoreChange(store.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    selectedStoreId === store.id ? 'bg-amber-100 font-semibold text-slate-950' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="block">{store.storeCode || `#${store.id}`}</span>
                  <span className="block truncate text-xs text-slate-500">{store.name || store.addressLine}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex min-w-0 w-full flex-col gap-5">
            <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-500">Налаштування магазину</div>
                  <div className="mt-1 text-xl font-bold">Власні лічильники магазину</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Створюйте власні лічильники для вибраного магазину. Після створення вони одразу будуть доступні у формі внесення показників.
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
                    2. Додати тариф
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
                  Оберіть магазин ліворуч, щоб створити для нього лічильники.
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
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
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
                                    {meter.ownerKind === 'tenant' ? meter.tenantName || 'Орендар' : 'Магазин'}
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

            <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm text-slate-500">Поточний перегляд</div>
              <div className="mt-1 text-xl font-bold">{selectedStore ? getStoreLabel(selectedStore) : 'Усі магазини'}</div>
              {selectedStore ? <div className="mt-1 text-sm text-slate-600">{selectedStore.city}, {selectedStore.addressLine}</div> : null}
            </section>

            {payload.totals ? (
              <section className="grid gap-3 md:grid-cols-5">
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

            <section className="w-full overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              <div className="w-full overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-3">Магазин</th>
                      <th className="px-3 py-3">Лічильник</th>
                      <th className="px-3 py-3">Власник</th>
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
                          <div className="font-medium">{item.utilityLabel}</div>
                          <div className="text-xs text-slate-500">{item.meterNumber || 'Без номера'}</div>
                        </td>
                        <td className="px-3 py-3 align-top">{item.tenantName || 'Магазин'}</td>
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
                          {item.charge?.validationMessages?.length ? (
                            <div className="mt-2 max-w-sm text-xs text-slate-600">{item.charge.validationMessages.join(' ')}</div>
                          ) : null}
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
      </div>
    </main>
  );
}
