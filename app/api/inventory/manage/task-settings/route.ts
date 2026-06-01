import { NextResponse } from 'next/server';

import { canManageInventoryTaskMode } from '@/lib/inventory-user-roles';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';
import {
  findStoreByIdInDb,
  updateStoreTaskAssignmentModeInDb
} from '@/lib/stores-repository';
import {
  inventoryTaskAssignmentModes,
  type InventoryTaskAssignmentMode
} from '@/lib/store-types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      taskAssignmentMode?: InventoryTaskAssignmentMode;
    };

    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(String(body?.token ?? ''), settings.webhookSecret);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const actingUser = await findInventoryUserByChatId(payload.chatId);
    if (!actingUser || !actingUser.isActive || !actingUser.storeId) {
      return NextResponse.json({ ok: false, error: 'Користувача не знайдено або обліковий запис недоступний.' }, { status: 403 });
    }
    if (!canManageInventoryTaskMode(actingUser.role)) {
      return NextResponse.json({ ok: false, error: 'Лише керівник магазину або адміністратор може змінювати режим задач.' }, { status: 403 });
    }

    const nextMode = String(body?.taskAssignmentMode ?? '');
    if (!inventoryTaskAssignmentModes.includes(nextMode as InventoryTaskAssignmentMode)) {
      return NextResponse.json({ ok: false, error: 'Некоректний режим задач.' }, { status: 400 });
    }

    await updateStoreTaskAssignmentModeInDb({
      storeId: actingUser.storeId,
      taskAssignmentMode: nextMode as InventoryTaskAssignmentMode
    });

    const store = await findStoreByIdInDb(actingUser.storeId);

    return NextResponse.json({
      ok: true,
      taskAssignmentMode: store?.taskAssignmentMode ?? (nextMode as InventoryTaskAssignmentMode)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося оновити режим задач.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
