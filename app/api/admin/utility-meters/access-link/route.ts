import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { createInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { listInventoryUsersFromDb } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as { storeId?: string | number };
    const storeId = Number(body?.storeId);

    if (!Number.isFinite(storeId) || storeId <= 0) {
      return NextResponse.json({ ok: false, error: 'Оберіть магазин для створення посилання.' }, { status: 400 });
    }

    const settings = await getInventoryTelegramSettingsFromDb();
    if (!settings.webhookSecret) {
      return NextResponse.json({ ok: false, error: 'Не налаштовано секрет Telegram інтеграції.' }, { status: 500 });
    }

    const users = await listInventoryUsersFromDb({ storeId, limit: 50 });
    const user = users.find((item) => item.isActive && item.userChatId && item.storeId === storeId);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Для цього магазину немає активного працівника з Telegram chat_id.' },
        { status: 404 }
      );
    }

    const token = createInventoryRegistrationToken(
      {
        chatId: user.userChatId,
        firstName: user.name,
        lastName: user.surname,
        username: ''
      },
      settings.webhookSecret
    );

    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const requestOrigin = forwardedHost
      ? `${forwardedProto || requestUrl.protocol.replace(':', '')}://${forwardedHost}`
      : requestUrl.origin;
    const inputUrl = new URL('/utility-meters', settings.publicBaseUrl || requestOrigin);
    inputUrl.searchParams.set('token', token);

    return NextResponse.json({
      ok: true,
      url: inputUrl.toString(),
      user: {
        id: String(user.id),
        name: `${user.surname} ${user.name}`.trim(),
        role: user.role
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
