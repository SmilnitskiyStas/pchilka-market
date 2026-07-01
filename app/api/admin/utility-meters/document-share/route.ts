import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { createUtilityMeterDocumentShareToken } from '@/lib/utility-meter-document-share-token';
import { normalizeUtilityPeriodMonth } from '@/lib/utility-meter-payment-document';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as {
      periodMonth?: string;
      storeId?: string | number | null;
    };

    const periodMonth = normalizeUtilityPeriodMonth(body?.periodMonth);
    const storeId = String(body?.storeId ?? '').trim();
    const settings = await getInventoryTelegramSettingsFromDb();

    if (!settings.webhookSecret) {
      return NextResponse.json({ ok: false, error: 'Не налаштовано секрет для формування зовнішніх посилань.' }, { status: 500 });
    }

    const token = createUtilityMeterDocumentShareToken({ periodMonth, storeId }, settings.webhookSecret);

    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const requestOrigin = forwardedHost
      ? `${forwardedProto || requestUrl.protocol.replace(':', '')}://${forwardedHost}`
      : requestUrl.origin;

    const shareUrl = new URL('/utility-meters/document', settings.publicBaseUrl || requestOrigin);
    shareUrl.searchParams.set('shareToken', token);

    return NextResponse.json({ ok: true, url: shareUrl.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
