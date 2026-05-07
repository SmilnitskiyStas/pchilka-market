import { NextResponse } from 'next/server';

import { canManageInventoryUsers } from '@/lib/inventory-user-roles';
import { listInventoryBatchesFromDb, reassignInventoryBatchResponsibleInDb } from '@/lib/inventory-batches-repository';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      batchId?: string | number;
      responsibleUserId?: string | number | null;
    };

    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(String(body?.token ?? ''), settings.webhookSecret);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const actingUser = await findInventoryUserByChatId(payload.chatId);
    if (!actingUser || !actingUser.isActive || !actingUser.storeId) {
      return NextResponse.json({ ok: false, error: 'Користувача не знайдено або його обліковий запис недоступний.' }, { status: 403 });
    }
    if (!canManageInventoryUsers(actingUser.role)) {
      return NextResponse.json({ ok: false, error: 'Доступ лише для manager, store_manager або admin.' }, { status: 403 });
    }

    const batchId = String(body?.batchId ?? '');
    const storeBatches = await listInventoryBatchesFromDb(300, actingUser.storeId);
    const targetBatch = storeBatches.find((item) => item.id === batchId);
    if (!targetBatch) {
      return NextResponse.json({ ok: false, error: 'Партію цього магазину не знайдено.' }, { status: 404 });
    }

    const batch = await reassignInventoryBatchResponsibleInDb({
      batchId,
      responsibleUserId: body?.responsibleUserId ?? null,
      storeId: actingUser.storeId
    });

    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося переназначити товар.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
