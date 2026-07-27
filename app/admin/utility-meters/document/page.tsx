import { UtilityMeterDocumentActions } from '@/components/utility-meter-document-actions';
import { UtilityMeterDocumentStoreSelector } from '@/components/utility-meter-document-store-selector';
import { UtilityMeterPaymentDocument } from '@/components/utility-meter-payment-document';
import Link from 'next/link';
import {
  getUtilityPaymentDocumentData,
  normalizeUtilityPaymentDocumentAudience,
  normalizeUtilityPaymentDocumentStoreIds,
  normalizeUtilityPeriodMonth
} from '@/lib/utility-meter-payment-document';
import { listStoresFromDb } from '@/lib/stores-repository';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{
    periodMonth?: string;
    storeId?: string;
    storeIds?: string;
    audience?: string;
  }>;
};

export default async function UtilityMetersDocumentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const periodMonth = normalizeUtilityPeriodMonth(params.periodMonth);
  const storeId = String(params.storeId ?? '').trim();
  const storeIds = normalizeUtilityPaymentDocumentStoreIds(params.storeIds);
  const audience = normalizeUtilityPaymentDocumentAudience(params.audience);
  const [document, stores] = await Promise.all([
    getUtilityPaymentDocumentData({ periodMonth, storeId, storeIds, audience }),
    listStoresFromDb()
  ]);
  const activeStores = stores.filter((store) => store.isActive);
  const storeIdsValue = storeIds.join(',');

  const pdfUrl = `/api/utility-meters/document-export?${new URLSearchParams({
    format: 'pdf',
    periodMonth,
    audience,
    ...(storeIdsValue ? { storeIds: storeIdsValue } : storeId ? { storeId } : {})
  }).toString()}`;

  const excelUrl = `/api/utility-meters/document-export?${new URLSearchParams({
    format: 'xlsx',
    periodMonth,
    audience,
    ...(storeIdsValue ? { storeIds: storeIdsValue } : storeId ? { storeId } : {})
  }).toString()}`;

  return (
    <UtilityMeterPaymentDocument
      document={document}
      actions={
        <>
          <nav className="flex flex-wrap gap-2" aria-label="Тип рахунку">
            {(['stores', 'tenants'] as const).map((item) => (
              <Link
                key={item}
                href={`/admin/utility-meters/document?${new URLSearchParams({
                  periodMonth,
                  audience: item,
                  ...(storeIdsValue ? { storeIds: storeIdsValue } : storeId ? { storeId } : {})
                }).toString()}`}
                className={`rounded-md px-4 py-2.5 text-sm font-semibold ${
                  item === audience ? 'bg-slate-950 text-white' : 'border border-slate-300 bg-white text-slate-900'
                }`}
              >
                {item === 'stores' ? 'Рахунок магазинів' : 'Рахунок орендарів'}
              </Link>
            ))}
          </nav>
          <UtilityMeterDocumentStoreSelector
            stores={activeStores}
            selectedStoreIds={storeIds.length > 0 ? storeIds : storeId ? [storeId] : []}
            periodMonth={periodMonth}
            audience={audience}
          />
          <UtilityMeterDocumentActions
            pdfUrl={pdfUrl}
            excelUrl={excelUrl}
            shareApiUrl="/api/admin/utility-meters/document-share"
            sharePayload={{ periodMonth, audience, ...(storeIdsValue ? { storeIds: storeIdsValue } : storeId ? { storeId } : {}) }}
          />
        </>
      }
    />
  );
}
