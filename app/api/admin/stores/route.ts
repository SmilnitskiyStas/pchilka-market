import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { listStoresFromDb, replaceStoresInDb } from '@/lib/stores-repository';
import { normalizeStore, type StoreRecord } from '@/lib/store-types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const stores = await listStoresFromDb();
    return NextResponse.json({ ok: true, stores });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as { stores?: Partial<StoreRecord>[] };
    const stores = Array.isArray(body?.stores) ? body.stores.map(normalizeStore) : [];
    const saved = await replaceStoresInDb(stores);
    revalidatePath('/about/stores');
    revalidatePath('/');
    return NextResponse.json({ ok: true, stores: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
