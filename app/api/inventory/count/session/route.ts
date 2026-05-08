import { NextResponse } from 'next/server';

import { createInventoryCountSessionInDb } from '@/lib/inventory-count-sessions-repository';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      scheduledFor?: string;
    };

    const user = await resolveInventorySessionUserFromToken(String(body?.token ?? ''));
    const result = await createInventoryCountSessionInDb({
      storeId: user.storeId ?? 0,
      startedByUserId: user.id,
      scheduledFor: String(body?.scheduledFor ?? '').trim() || undefined
    });

    return NextResponse.json({ ok: true, session: result.session, items: result.items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося створити сесію інвентаризації.';
    const status = message.includes('токен') ? 400 : message.includes('Користувача') ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
