import { NextResponse } from 'next/server';

import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryPositionTitlesFromDb } from '@/lib/inventory-position-settings-repository';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';
import { listStoresFromDb } from '@/lib/stores-repository';

export const runtime = 'nodejs';

const INVALID_REGISTRATION_TOKEN_MESSAGE =
  'Посилання недійсне або прострочене. Щоб створити нове посилання, відкрийте Telegram-бот і натисніть /start.';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(token, settings.webhookSecret);

    if (!payload) {
      return NextResponse.json({ ok: false, error: INVALID_REGISTRATION_TOKEN_MESSAGE }, { status: 400 });
    }

    const existingUser = await findInventoryUserByChatId(payload.chatId);
    const stores = await listStoresFromDb();
    const positionTitles = await getInventoryPositionTitlesFromDb();

    return NextResponse.json({
      ok: true,
      alreadyRegistered: Boolean(existingUser),
      user: existingUser
        ? {
            id: existingUser.id,
            name: existingUser.name,
            surname: existingUser.surname,
            positionTitle: existingUser.positionTitle,
            role: existingUser.role
          }
        : null,
      tokenPayload: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        username: payload.username
      },
      stores: stores.filter((store) => store.isActive),
      positionTitles
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
