import { NextResponse } from 'next/server';

import { canManageInventoryUsers } from '@/lib/inventory-user-roles';
import { listInventoryBatchesFromDb } from '@/lib/inventory-batches-repository';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryUserByChatId, listInventoryUsersFromDb } from '@/lib/inventory-users-repository';
import { listStoresFromDb } from '@/lib/stores-repository';

export const runtime = 'nodejs';

function daysUntil(value: string) {
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = target.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(token, settings.webhookSecret);

    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const user = await findInventoryUserByChatId(payload.chatId);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Користувача не знайдено.' }, { status: 404 });
    }
    if (!user.isActive) {
      return NextResponse.json({ ok: false, error: 'Обліковий запис деактивовано.' }, { status: 403 });
    }
    if (!user.storeId) {
      return NextResponse.json({ ok: false, error: "Для користувача не прив'язано магазин." }, { status: 400 });
    }
    if (!canManageInventoryUsers(user.role)) {
      return NextResponse.json({ ok: false, error: 'Доступ лише для manager, store_manager або admin.' }, { status: 403 });
    }

    const [users, batches, stores] = await Promise.all([
      listInventoryUsersFromDb({ storeId: user.storeId, limit: 300 }),
      listInventoryBatchesFromDb(300, user.storeId),
      listStoresFromDb()
    ]);
    const store = stores.find((item) => item.id === String(user.storeId));

    const storeBatches = batches.map((batch) => ({
      ...batch,
      daysLeft: daysUntil(batch.expiryDate)
    }));

    const expiringBatches = storeBatches
      .filter((batch) => batch.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft || a.expiryDate.localeCompare(b.expiryDate));

    return NextResponse.json({
      ok: true,
      user,
      store,
      taskAssignmentMode: store?.taskAssignmentMode ?? 'personal',
      users,
      storeBatches,
      expiringBatches
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
