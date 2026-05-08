import { NextResponse } from 'next/server';

import { updateInventoryCountItemInDb } from '@/lib/inventory-count-sessions-repository';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      sessionId?: string | number;
      itemId?: string | number;
      countedQuantity?: string | number;
      note?: string;
    };

    const user = await resolveInventorySessionUserFromToken(String(body?.token ?? ''));
    const item = await updateInventoryCountItemInDb({
      sessionId: body?.sessionId ?? '',
      itemId: body?.itemId ?? '',
      countedQuantity: Number(body?.countedQuantity ?? 0),
      note: String(body?.note ?? ''),
      checkedByUserId: user.id,
      storeId: Number(user.storeId ?? 0)
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося зберегти позицію інвентаризації.';
    const status = message.includes('токен') ? 400 : message.includes('Користувача') ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
