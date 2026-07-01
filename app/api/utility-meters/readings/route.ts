import { NextResponse } from 'next/server';

import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';
import { findStoreByIdInDb } from '@/lib/stores-repository';
import { createUtilityMeterReadingInDb } from '@/lib/utility-metering-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body?.token ?? '');
    const meterPointId = String(body?.meterPointId ?? '');
    const readingDate = String(body?.readingDate ?? '');
    const readingValue = Number(body?.readingValue);
    const previousValueOverride =
      body?.previousValueOverride == null || body?.previousValueOverride === ''
        ? undefined
        : Number(body?.previousValueOverride);
    const notes = typeof body?.notes === 'string' ? body.notes : '';

    const user = await resolveInventorySessionUserFromToken(token);
    if (!user.storeId) throw new Error('Для користувача не привʼязано магазин.');

    const store = await findStoreByIdInDb(user.storeId);
    const result = await createUtilityMeterReadingInDb({
      meterPointId,
      storeId: user.storeId,
      storeCode: store?.storeCode,
      readingDate,
      readingValue,
      previousValueOverride,
      submittedByUserId: user.id,
      submittedByName: `${user.surname} ${user.name}`.trim(),
      notes
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
