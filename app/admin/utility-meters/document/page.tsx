import { UtilityMeterDocumentActions } from '@/components/utility-meter-document-actions';
import { UtilityMeterPaymentDocument } from '@/components/utility-meter-payment-document';
import {
  getUtilityPaymentDocumentData,
  normalizeUtilityPeriodMonth
} from '@/lib/utility-meter-payment-document';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{
    periodMonth?: string;
    storeId?: string;
  }>;
};

export default async function UtilityMetersDocumentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const periodMonth = normalizeUtilityPeriodMonth(params.periodMonth);
  const storeId = String(params.storeId ?? '').trim();
  const document = await getUtilityPaymentDocumentData({ periodMonth, storeId });

  const pdfUrl = `/api/utility-meters/document-export?${new URLSearchParams({
    format: 'pdf',
    periodMonth,
    ...(storeId ? { storeId } : {})
  }).toString()}`;

  const excelUrl = `/api/utility-meters/document-export?${new URLSearchParams({
    format: 'xlsx',
    periodMonth,
    ...(storeId ? { storeId } : {})
  }).toString()}`;

  return (
    <UtilityMeterPaymentDocument
      document={document}
      actions={
        <UtilityMeterDocumentActions
          pdfUrl={pdfUrl}
          excelUrl={excelUrl}
          shareApiUrl="/api/admin/utility-meters/document-share"
          sharePayload={{ periodMonth, ...(storeId ? { storeId } : {}) }}
        />
      }
    />
  );
}
