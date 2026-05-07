import { NextResponse } from 'next/server';

import {
  canAssignInventoryRole,
  canEditInventoryTargetRole,
  canManageInventoryUsers,
  normalizeInventoryUserRole,
  type InventoryUserRole
} from '@/lib/inventory-user-roles';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import {
  findInventoryUserByChatId,
  listInventoryUsersFromDb,
  updateInventoryUserInDb
} from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      userId?: string | number;
      role?: InventoryUserRole;
      positionTitle?: string;
      isActive?: boolean;
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
      return NextResponse.json({ ok: false, error: 'Доступ лише для керівника, менеджера або адміністратора.' }, { status: 403 });
    }

    const targetUserId = Number(body?.userId);
    const storeUsers = await listInventoryUsersFromDb({ storeId: actingUser.storeId, limit: 300 });
    const targetUser = storeUsers.find((item) => item.id === targetUserId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: 'Працівника цього магазину не знайдено.' }, { status: 404 });
    }

    const nextRole = body?.role ? normalizeInventoryUserRole(body.role) : undefined;
    if (!canEditInventoryTargetRole(actingUser.role, targetUser.role)) {
      return NextResponse.json({ ok: false, error: 'Недостатньо прав для зміни цього користувача.' }, { status: 403 });
    }
    if (nextRole && !canAssignInventoryRole(actingUser.role, nextRole)) {
      return NextResponse.json({ ok: false, error: 'Недостатньо прав для призначення цієї ролі.' }, { status: 403 });
    }
    if (Number(body?.userId) === actingUser.id && body?.isActive === false) {
      return NextResponse.json({ ok: false, error: 'Не можна деактивувати самого себе.' }, { status: 400 });
    }

    const user = await updateInventoryUserInDb({
      userId: body?.userId ?? '',
      storeId: actingUser.storeId,
      scopedStoreId: actingUser.storeId,
      role: nextRole,
      positionTitle: String(body?.positionTitle ?? ''),
      isActive: body?.isActive
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося оновити працівника.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
