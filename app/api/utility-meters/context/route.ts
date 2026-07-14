import { NextResponse } from 'next/server';

import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';
import { findStoreByIdInDb } from '@/lib/stores-repository';
import { assertUtilityMeterTestAccess } from '@/lib/utility-meter-access';
import { listUtilityMeterReadingHistoryByMeterIdsInDb, listUtilityMetersForStoreInDb } from '@/lib/utility-metering-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const user = await resolveInventorySessionUserFromToken(token);
    assertUtilityMeterTestAccess(user);
    if (!user.storeId) throw new Error('Для користувача не привʼязано магазин.');

    const store = await findStoreByIdInDb(user.storeId);
    const meters = await listUtilityMetersForStoreInDb({
      storeId: user.storeId,
      storeCode: store?.storeCode
    });
    const historyByMeterId = await listUtilityMeterReadingHistoryByMeterIdsInDb({
      meterPointIds: meters.map((meter) => meter.id),
      limitPerMeter: 12
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        positionTitle: user.positionTitle,
        storeId: String(user.storeId),
        storeCode: store?.storeCode ?? '',
        storeLabel: user.storeLabel
      },
      meters,
      historyByMeterId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
