import { NextResponse } from 'next/server';

import { completeInventoryCountSessionInDb } from '@/lib/inventory-count-sessions-repository';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      sessionId?: string | number;
    };

    const user = await resolveInventorySessionUserFromToken(String(body?.token ?? ''));
    const result = await completeInventoryCountSessionInDb({
      sessionId: body?.sessionId ?? '',
      completedByUserId: user.id,
      storeId: Number(user.storeId ?? 0)
    });

    return NextResponse.json({ ok: true, session: result.session, items: result.items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося завершити інвентаризацію.';
    const status = message.includes('токен') ? 400 : message.includes('Користувача') ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
