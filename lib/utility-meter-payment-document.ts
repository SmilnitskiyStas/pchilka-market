import { findStoreByIdInDb, listStoresFromDb } from '@/lib/stores-repository';
import { listUtilityMeterReviewInDb } from '@/lib/utility-metering-repository';
import { listUtilityStoreDirectContractsByStoreIds, type UtilityElectricitySupplier } from '@/lib/utility-store-direct-contracts';
import type { UtilityType } from '@/lib/utility-metering-types';

export const utilityPaymentDocumentAudiences = ['stores', 'tenants'] as const;
export type UtilityPaymentDocumentAudience = (typeof utilityPaymentDocumentAudiences)[number];

export function normalizeUtilityPaymentDocumentAudience(value: string | undefined | null): UtilityPaymentDocumentAudience {
  return value === 'tenants' ? 'tenants' : 'stores';
}

export function getUtilityPaymentDocumentAudienceLabel(audience: UtilityPaymentDocumentAudience) {
  return audience === 'tenants' ? 'Орендарі' : 'Магазини';
}

export type UtilityPaymentDocumentRow = {
  id: string;
  storeCode: string;
  storeLabel: string;
  addressLine: string;
  legalEntity: string;
  electricitySupplier?: UtilityElectricitySupplier;
  isDirectContract: boolean;
  tenantName: string;
  meterNumber: string;
  utilityType: UtilityType;
  utilityLabel: string;
  previousValue?: number;
  readingValue?: number;
  readingDate: string;
  submittedAt: string;
  coefficient: number;
  consumption?: number;
  rate?: number;
  calculationMode: 'rate' | 'fixed_amount';
  fixedAmount?: number;
  invoiceReference: string;
  amount?: number;
  includesVat: boolean;
  amountWithoutVat?: number;
  amountWithVat?: number;
};

export type UtilityPaymentDocumentData = {
  periodMonth: string;
  audience: UtilityPaymentDocumentAudience;
  audienceLabel: string;
  storeId: string;
  storeIds: string[];
  storeCode: string;
  storeLabel: string;
  total: number;
  totalWithoutVat: number;
  totalWithVat: number;
  rows: UtilityPaymentDocumentRow[];
};

export function defaultUtilityPeriodMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function normalizeUtilityPeriodMonth(value: string | undefined) {
  return /^\d{4}-\d{2}-01$/.test(String(value ?? '').trim()) ? String(value).trim() : defaultUtilityPeriodMonth();
}

export function normalizeUtilityPaymentDocumentStoreIds(value: string | string[] | null | undefined) {
  const rawValues = Array.isArray(value) ? value : [value ?? ''];
  return rawValues
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter((item, index, list) => /^\d+$/.test(item) && Number(item) > 0 && list.indexOf(item) === index);
}

export function formatUtilityMoney(value?: number) {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function getUtilityPaymentDocumentFileBaseName(input: {
  periodMonth: string;
  audience: UtilityPaymentDocumentAudience;
  storeCode?: string;
  storeId?: string;
}) {
  const month = input.periodMonth.slice(0, 7);
  const suffixRaw = `${input.audience}-${input.storeCode || input.storeId || 'all-stores'}`;
  const suffix = suffixRaw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'all-stores';
  return `utility-payment-document-${month}-${suffix}`;
}

export async function getUtilityPaymentDocumentData(input: {
  periodMonth: string;
  storeId?: string | number | null;
  storeIds?: string | string[] | null;
  audience?: UtilityPaymentDocumentAudience;
}) {
  const normalizedStoreIds = normalizeUtilityPaymentDocumentStoreIds(input.storeIds);
  const normalizedStoreId = normalizedStoreIds.length === 1 ? normalizedStoreIds[0] : String(input.storeId ?? '').trim();
  const audience = normalizeUtilityPaymentDocumentAudience(input.audience);
  const [store, allStores] = await Promise.all([
    normalizedStoreId ? findStoreByIdInDb(normalizedStoreId) : Promise.resolve(null),
    normalizedStoreIds.length > 1 ? listStoresFromDb() : Promise.resolve([])
  ]);
  const selectedStores = normalizedStoreIds.length > 1 ? allStores.filter((item) => normalizedStoreIds.includes(item.id)) : store ? [store] : [];
  const items = await listUtilityMeterReviewInDb({
    periodMonth: input.periodMonth,
    storeIds: normalizedStoreIds,
    storeId: normalizedStoreIds.length === 0 ? normalizedStoreId || null : null,
    storeCode: store?.storeCode
  });
  const contractsByStoreId = await listUtilityStoreDirectContractsByStoreIds(
    items.flatMap((item) => (item.storeId ? [item.storeId] : []))
  );

  const rows: UtilityPaymentDocumentRow[] = items
    .filter((item) => item.reading && item.charge && (audience === 'stores' ? item.ownerKind === 'store' : item.ownerKind === 'tenant'))
    .map((item) => {
      const contract = item.storeId ? contractsByStoreId.get(item.storeId) : undefined;
      return {
        id: item.id,
        storeCode: item.storeCode,
        storeLabel: item.storeLabel,
        addressLine: item.addressLine,
        legalEntity: contract?.legalEntity ?? '',
        electricitySupplier: contract?.electricitySupplier,
        isDirectContract: contract?.isDirectContract ?? false,
        tenantName: item.tenantName || 'Магазин',
        meterNumber: item.meterNumber || 'Без номера',
        utilityType: item.utilityType,
        utilityLabel: item.utilityLabel,
        previousValue: item.charge?.previousValue,
        readingValue: item.reading?.readingValue,
        readingDate: item.reading?.readingDate ?? '',
        submittedAt: item.reading?.submittedAt ?? '',
        coefficient: item.charge?.coefficient ?? item.coefficient,
        consumption: item.charge?.consumption,
        rate: item.charge?.rate,
        calculationMode: item.charge?.calculationMode ?? 'rate',
        fixedAmount: item.charge?.fixedAmount,
        invoiceReference: item.charge?.invoiceReference ?? '',
        amount: item.charge?.amount,
        includesVat: item.charge?.includesVat ?? true,
        amountWithoutVat: item.charge?.amountWithoutVat,
        amountWithVat: item.charge?.amountWithVat
      };
    });

  return {
    periodMonth: input.periodMonth,
    audience,
    audienceLabel: getUtilityPaymentDocumentAudienceLabel(audience),
    storeId: normalizedStoreId,
    storeIds: normalizedStoreIds,
    storeCode: store?.storeCode || '',
    storeLabel:
      selectedStores.length > 1
        ? `Обрані магазини (${selectedStores.length}): ${selectedStores.map((item) => item.storeCode || item.name).join(', ')}`
        : store
          ? [store.storeCode, store.name || store.addressLine].filter(Boolean).join(' · ')
          : 'Усі магазини',
    total: rows.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    totalWithoutVat: rows.reduce((sum, item) => sum + (item.amountWithoutVat ?? 0), 0),
    totalWithVat: rows.reduce((sum, item) => sum + (item.amountWithVat ?? 0), 0),
    rows
  } satisfies UtilityPaymentDocumentData;
}
