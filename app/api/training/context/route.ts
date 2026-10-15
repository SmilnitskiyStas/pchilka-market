import { NextResponse } from 'next/server';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';
import { listTrainingAttemptsForUser, listTrainingCatalogForUser } from '@/lib/training-tests-repository';
import { listStoresFromDb } from '@/lib/stores-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token') ?? '';
    const user = await resolveInventorySessionUserFromToken(token);
    const [catalog, attempts, stores] = await Promise.all([listTrainingCatalogForUser(user.id), listTrainingAttemptsForUser(user.id), listStoresFromDb()]);
    return NextResponse.json({ ok: true, user: { name: user.name, surname: user.surname, storeId: user.storeId, storeLabel: user.storeLabel }, stores: stores.filter((store) => store.isActive).map((store) => ({ id: store.id, label: [store.storeCode, store.city, store.addressLine].filter(Boolean).join(' | ') || store.name })), catalog, attempts });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити тести.' }, { status: 401 });
  }
}
