import { NextResponse } from 'next/server';

import { createInventoryActivityLogInDb } from '@/lib/inventory-activity-logs-repository';
import { findInventoryBatchByIdInDb, updateInventoryBatchCheckActionInDb } from '@/lib/inventory-batches-repository';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

type ActionPayload = {
  token?: string;
  batchId?: string;
  action?: 'checked' | 'writeoff' | 'discussion_required';
  note?: string;
};

const ALLOWED_ACTIONS = new Set<ActionPayload['action']>(['checked', 'writeoff', 'discussion_required']);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActionPayload;
    const token = String(body.token ?? '').trim();
    const batchId = String(body.batchId ?? '').trim();
    const action = body.action;
    const note = String(body.note ?? '').trim();

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, error: 'Некоректна дія для партії.' }, { status: 400 });
    }
    const safeAction = action as 'checked' | 'writeoff' | 'discussion_required';

    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(token, settings.webhookSecret);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const user = await findInventoryUserByChatId(payload.chatId);
    if (!user || !user.isActive || !user.storeId) {
      return NextResponse.json({ ok: false, error: 'Користувача не знайдено або обліковий запис недоступний.' }, { status: 403 });
    }

    const existingBatch = await findInventoryBatchByIdInDb(batchId);
    if (!existingBatch) {
      return NextResponse.json({ ok: false, error: 'Партію не знайдено.' }, { status: 404 });
    }
    if (String(user.storeId) !== existingBatch.storeId) {
      return NextResponse.json({ ok: false, error: 'Немає доступу до партії іншого магазину.' }, { status: 403 });
    }

    const batch = await updateInventoryBatchCheckActionInDb({
      batchId,
      userId: user.id,
      storeId: user.storeId,
      action: safeAction,
      note
    });

    await createInventoryActivityLogInDb({
      userId: user.id,
      batchId: Number(batch.id),
      productId: Number(batch.productId),
      storeId: Number(batch.storeId),
      actionType: `batch_check_${safeAction}`,
      comment: note || null
    });

    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown batch action error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
