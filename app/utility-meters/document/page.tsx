import { UtilityMeterDocumentActions } from '@/components/utility-meter-document-actions';
import { UtilityMeterPaymentDocument } from '@/components/utility-meter-payment-document';
import { parseUtilityMeterDocumentShareToken } from '@/lib/utility-meter-document-share-token';
import { getUtilityPaymentDocumentData } from '@/lib/utility-meter-payment-document';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{
    shareToken?: string;
  }>;
};

export default async function PublicUtilityMetersDocumentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const shareToken = String(params.shareToken ?? '').trim();
  const settings = await getInventoryTelegramSettingsFromDb();

  if (!shareToken || !settings.webhookSecret) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-white p-6 text-red-800">
          Посилання для перегляду документа недійсне або ще не налаштоване.
        </div>
      </main>
    );
  }

  const payload = parseUtilityMeterDocumentShareToken(shareToken, settings.webhookSecret);
  if (!payload) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-white p-6 text-red-800">
          Посилання для перегляду документа недійсне або прострочене.
        </div>
      </main>
    );
  }

  const document = await getUtilityPaymentDocumentData({
    periodMonth: payload.periodMonth,
    storeId: payload.storeId
  });

  const pdfUrl = `/api/utility-meters/document-export?${new URLSearchParams({
    format: 'pdf',
    shareToken
  }).toString()}`;
  const excelUrl = `/api/utility-meters/document-export?${new URLSearchParams({
    format: 'xlsx',
    shareToken
  }).toString()}`;

  return (
    <UtilityMeterPaymentDocument
      document={document}
      actions={<UtilityMeterDocumentActions pdfUrl={pdfUrl} excelUrl={excelUrl} />}
    />
  );
}
