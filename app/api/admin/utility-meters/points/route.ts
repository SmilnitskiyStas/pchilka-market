import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  createUtilityMeterPointInDb,
  listUtilityMetersForStoreInDb,
  setUtilityMeterPointActiveStateInDb,
  updateUtilityMeterPointInDb
} from '@/lib/utility-metering-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const url = new URL(request.url);
    const storeId = url.searchParams.get('storeId') ?? '';
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
      ownerKind: body?.ownerKind,
      tenantName: body?.tenantName,
      legalEntity: body?.legalEntity,
      providerName: body?.providerName,
      contractNumber: body?.contractNumber,
      areaSqM: body?.areaSqM
    });

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
