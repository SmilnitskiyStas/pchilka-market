import { NextResponse } from 'next/server';

import {
  findActiveInventoryCountSessionForStoreInDb,
  listInventoryCountItemsForSessionInDb,
  listInventoryCountSessionsForStoreInDb
} from '@/lib/inventory-count-sessions-repository';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const user = await resolveInventorySessionUserFromToken(token);

    const activeSession = await findActiveInventoryCountSessionForStoreInDb(user.storeId ?? 0);
    const [sessionHistory, activeItems] = await Promise.all([
      listInventoryCountSessionsForStoreInDb(user.storeId ?? 0, 12),
      activeSession ? listInventoryCountItemsForSessionInDb(activeSession.id) : Promise.resolve([])
    ]);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        role: user.role,
        storeId: user.storeId,
        storeLabel: user.storeLabel
      },
      activeSession,
      activeItems,
      sessionHistory
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося завантажити інвентаризацію.';
    const status = message.includes('токен') ? 400 : message.includes('Користувача') ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
