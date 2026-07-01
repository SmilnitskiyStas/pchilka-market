import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  assignUtilityMeterPointsToStoreInDb,
  listUtilityMeterMappingGroupsInDb
} from '@/lib/utility-metering-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const groups = await listUtilityMeterMappingGroupsInDb();
    return NextResponse.json({ ok: true, groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const body = (await request.json()) as {
      meterPointIds?: Array<string | number>;
      storeId?: string | number | null;
    };
    const result = await assignUtilityMeterPointsToStoreInDb({
      meterPointIds: Array.isArray(body.meterPointIds) ? body.meterPointIds : [],
      storeId: body.storeId
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
