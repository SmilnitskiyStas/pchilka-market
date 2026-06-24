import { NextResponse } from 'next/server';

import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { ensureInventoryPositionTitleInDb } from '@/lib/inventory-position-settings-repository';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { createInventoryUserInDb, findInventoryUserByChatId } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

const INVALID_REGISTRATION_TOKEN_MESSAGE =
  'Посилання недійсне або прострочене. Щоб створити нове посилання, відкрийте Telegram-бот і натисніть /start.';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      name?: string;
      surname?: string;
      positionTitle?: string;
      storeId?: string | number;
    };

    const settings = await getInventoryTelegramSettingsFromDb();
    const token = String(body?.token ?? '');
    const payload = parseInventoryRegistrationToken(token, settings.webhookSecret);
    if (!payload) {
      return NextResponse.json({ ok: false, error: INVALID_REGISTRATION_TOKEN_MESSAGE }, { status: 400 });
    }

    const existingUser = await findInventoryUserByChatId(payload.chatId);
    if (existingUser) {
      return NextResponse.json(
        { ok: false, error: 'Користувач з цим Telegram уже зареєстрований.' },
        { status: 409 }
      );
    }

    const name = String(body?.name ?? '').trim();
    const surname = String(body?.surname ?? '').trim();
    const positionTitle = String(body?.positionTitle ?? '').trim();
    const storeId = Number(body?.storeId);

    if (!name || !surname) {
      return NextResponse.json({ ok: false, error: "Ім'я та прізвище є обов'язковими." }, { status: 400 });
    }
    if (!positionTitle) {
      return NextResponse.json({ ok: false, error: 'Оберіть або вкажіть посаду.' }, { status: 400 });
    }
    if (!Number.isFinite(storeId) || storeId <= 0) {
      return NextResponse.json({ ok: false, error: 'Оберіть магазин.' }, { status: 400 });
    }

    const resolvedPositionTitle = await ensureInventoryPositionTitleInDb(positionTitle);

    const user = await createInventoryUserInDb({
      storeId,
      name,
      surname,
      positionTitle: resolvedPositionTitle,
      userChatId: payload.chatId,
      role: 'staff'
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
