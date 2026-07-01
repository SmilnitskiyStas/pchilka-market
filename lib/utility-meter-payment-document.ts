import { findStoreByIdInDb } from '@/lib/stores-repository';
import { listUtilityMeterReviewInDb } from '@/lib/utility-metering-repository';

export type UtilityPaymentDocumentRow = {
  id: string;
  storeCode: string;
  storeLabel: string;
  addressLine: string;
  tenantName: string;
  meterNumber: string;
  utilityLabel: string;
  readingValue?: number;
  consumption?: number;
  rate?: number;
  amount?: number;
};

export type UtilityPaymentDocumentData = {
  periodMonth: string;
  storeId: string;
  storeCode: string;
  storeLabel: string;
  total: number;
  rows: UtilityPaymentDocumentRow[];
};

export function defaultUtilityPeriodMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function normalizeUtilityPeriodMonth(value: string | undefined) {
  return /^\d{4}-\d{2}-01$/.test(String(value ?? '').trim()) ? String(value).trim() : defaultUtilityPeriodMonth();
}

export function formatUtilityMoney(value?: number) {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function getUtilityPaymentDocumentFileBaseName(input: { periodMonth: string; storeCode?: string; storeId?: string }) {
  const month = input.periodMonth.slice(0, 7);
  const suffixRaw = input.storeCode || input.storeId || 'all-stores';
  const suffix = suffixRaw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'all-stores';
  return `utility-payment-document-${month}-${suffix}`;
}

export async function getUtilityPaymentDocumentData(input: { periodMonth: string; storeId?: string | number | null }) {
  const normalizedStoreId = String(input.storeId ?? '').trim();
  const store = normalizedStoreId ? await findStoreByIdInDb(normalizedStoreId) : null;
  const items = await listUtilityMeterReviewInDb({
    periodMonth: input.periodMonth,
    storeId: normalizedStoreId || null,
    storeCode: store?.storeCode
  });

  const rows: UtilityPaymentDocumentRow[] = items
    .filter((item) => item.reading && item.charge)
    .map((item) => ({
      id: item.id,
      storeCode: item.storeCode,
      storeLabel: item.storeLabel,
      addressLine: item.addressLine,
      tenantName: item.tenantName || 'Магазин',
      meterNumber: item.meterNumber || 'Без номера',
      utilityLabel: item.utilityLabel,
      readingValue: item.reading?.readingValue,
      consumption: item.charge?.consumption,
      rate: item.charge?.rate,
      amount: item.charge?.amount
    }));

  return {
    periodMonth: input.periodMonth,
    storeId: normalizedStoreId,
    storeCode: store?.storeCode || '',
    storeLabel: store ? [store.storeCode, store.name || store.addressLine].filter(Boolean).join(' · ') : 'Усі магазини',
    total: rows.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    rows
  } satisfies UtilityPaymentDocumentData;
}
