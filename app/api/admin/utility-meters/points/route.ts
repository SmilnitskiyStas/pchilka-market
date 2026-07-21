import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  createUtilityMeterPointInDb,
  createUtilityMeterReadingInDb,
  findUtilityMeterPointInDb,
  listUtilityMeterRatesInDb,
  listUtilityMeterReadingHistoryByMeterIdsInDb,
  listUtilityMetersForStoreInDb,
  setUtilityMeterPointActiveStateInDb,
  updateUtilityMeterReadingInDb,
  updateUtilityMeterPointInDb
} from '@/lib/utility-metering-repository';
import { parseUtilityMeterDecimal } from '@/lib/utility-metering-calculator';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const url = new URL(request.url);
    const meterPointId = url.searchParams.get('meterPointId') ?? '';
    const storeId = url.searchParams.get('storeId') ?? '';

    if (meterPointId) {
      const meter = await findUtilityMeterPointInDb({ meterPointId });
      if (!meter) {
        return NextResponse.json({ ok: false, error: 'Лічильник не знайдено.' }, { status: 404 });
      }

      const historyByMeterId = await listUtilityMeterReadingHistoryByMeterIdsInDb({
        meterPointIds: [meterPointId],
        limitPerMeter: 60
      });
      const rates = await listUtilityMeterRatesInDb({ meterPointId });

      return NextResponse.json({
        ok: true,
        meter,
        history: historyByMeterId[String(meterPointId)] ?? [],
        rates
      });
    }

    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Оберіть магазин.' }, { status: 400 });
    }

    const meters = await listUtilityMetersForStoreInDb({ storeId, includeInactive: true });
    return NextResponse.json({ ok: true, meters });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const body = await request.json();
    const meter = await createUtilityMeterPointInDb({
      storeId: body?.storeId,
      utilityType: body?.utilityType,
      utilityLabel: body?.utilityLabel,
      meterNumber: body?.meterNumber,
      coefficient: body?.coefficient,
      initialReadingValue: body?.initialReadingValue,
      defaultRate: body?.defaultRate,
      ownerKind: body?.ownerKind,
      tenantName: body?.tenantName,
      legalEntity: body?.legalEntity,
      providerName: body?.providerName,
      contractNumber: body?.contractNumber,
      areaSqM: body?.areaSqM
    });

    if (
      body?.initialReadingValue != null &&
      typeof body?.initialReadingDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.initialReadingDate)
    ) {
      await createUtilityMeterReadingInDb({
        meterPointId: meter.id,
        storeId: body.storeId,
        readingDate: body.initialReadingDate,
        readingValue: Number(body.initialReadingValue),
        submittedByName: 'admin',
        notes: 'Початковий показник'
      });
    }

    return NextResponse.json({ ok: true, meter });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const body = await request.json();
    if (body?.readingId != null) {
      const result = await updateUtilityMeterReadingInDb({
        meterPointId: body?.meterPointId,
        readingId: body?.readingId,
        readingDate: String(body?.readingDate ?? ''),
        readingValue: parseUtilityMeterDecimal(body?.readingValue),
        previousValueOverride:
          body?.previousValueOverride == null || body?.previousValueOverride === ''
            ? undefined
            : parseUtilityMeterDecimal(body?.previousValueOverride)
      });
      return NextResponse.json({ ok: true, ...result });
    }
    const meter =
      typeof body?.isActive === 'boolean' && body?.updateFields !== true
        ? await setUtilityMeterPointActiveStateInDb({
            meterPointId: body?.meterPointId,
            storeId: body?.storeId,
            isActive: body.isActive
          })
        : await updateUtilityMeterPointInDb({
            meterPointId: body?.meterPointId,
            storeId: body?.storeId,
            utilityType: body?.utilityType,
            utilityLabel: body?.utilityLabel,
            meterNumber: body?.meterNumber,
            coefficient: body?.coefficient,
            initialReadingValue: body?.initialReadingValue,
            defaultRate: body?.defaultRate,
            ownerKind: body?.ownerKind,
            tenantName: body?.tenantName,
            legalEntity: body?.legalEntity,
            providerName: body?.providerName,
            contractNumber: body?.contractNumber,
            areaSqM: body?.areaSqM,
            isActive: typeof body?.isActive === 'boolean' ? body.isActive : true
          });

    return NextResponse.json({ ok: true, meter });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
