import { NextResponse } from 'next/server';

import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';
import { updateInventoryUserProfileInDb } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string; surname?: string; name?: string; storeId?: string | number };
    const user = await resolveInventorySessionUserFromToken(String(body.token ?? ''));
    const updated = await updateInventoryUserProfileInDb({ userId: user.id, surname: String(body.surname ?? ''), name: String(body.name ?? ''), storeId: Number(body.storeId) });
    return NextResponse.json({ ok: true, user: { surname: updated.surname, name: updated.name, storeId: updated.storeId, storeLabel: updated.storeLabel } });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося оновити профіль.' }, { status: 400 }); }
}
