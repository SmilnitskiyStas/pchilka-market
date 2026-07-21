import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  deleteUtilityMeterRateInDb,
  listUtilityMeterRatesInDb,
  upsertUtilityMeterRateInDb
} from '@/lib/utility-metering-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const url = new URL(request.url);
    const periodMonth = url.searchParams.get('periodMonth') ?? '';
    const storeId = url.searchParams.get('storeId') ?? '';
    const meterPointId = url.searchParams.get('meterPointId') ?? '';

    const rates = await listUtilityMeterRatesInDb({
      periodMonth: periodMonth || undefined,
      storeId: storeId || undefined,
      meterPointId: meterPointId || undefined
    });

    return NextResponse.json({ ok: true, rates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const body = await request.json();
    const rate = await upsertUtilityMeterRateInDb({
      storeId: body?.storeId,
      meterPointId: body?.meterPointId,
      utilityType: body?.utilityType,
      periodMonth: body?.periodMonth,
      rate: body?.rate,
      rateLabel: body?.rateLabel,
      includesVat: body?.includesVat,
      calculationMode: body?.calculationMode,
      fixedAmount: body?.fixedAmount,
      invoiceReference: body?.invoiceReference
    });

    return NextResponse.json({ ok: true, rate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const body = await request.json();
    const rate = await upsertUtilityMeterRateInDb({
      rateId: body?.rateId,
      storeId: body?.storeId,
      meterPointId: body?.meterPointId,
      utilityType: body?.utilityType,
      periodMonth: body?.periodMonth,
      rate: body?.rate,
      rateLabel: body?.rateLabel,
      includesVat: body?.includesVat,
      calculationMode: body?.calculationMode,
      fixedAmount: body?.fixedAmount,
      invoiceReference: body?.invoiceReference
    });

    return NextResponse.json({ ok: true, rate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const url = new URL(request.url);
    const rateId = url.searchParams.get('rateId') ?? '';
    const result = await deleteUtilityMeterRateInDb({ rateId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
