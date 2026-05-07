import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  buildInventoryWebhookUrl,
  isValidTelegramBotToken,
  isValidTelegramBotUsername,
  isValidTelegramChatId,
  isValidWebhookSecret,
  normalizeInventoryTelegramSettings,
  type InventoryTelegramSettings
} from '@/lib/inventory-telegram-settings';
import {
  getInventoryTelegramSettingsFromDb,
  saveInventoryTelegramSettingsToDb
} from '@/lib/inventory-telegram-settings-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const settings = await getInventoryTelegramSettingsFromDb();
    return NextResponse.json({
      ok: true,
      settings,
      webhookUrl: buildInventoryWebhookUrl(settings)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as { settings?: Partial<InventoryTelegramSettings> };
    const normalized = normalizeInventoryTelegramSettings(body?.settings);

    if (!isValidTelegramBotToken(normalized.botToken)) {
      return NextResponse.json({ ok: false, error: 'Некоректний Telegram bot token.' }, { status: 400 });
    }
    if (!isValidTelegramBotUsername(normalized.botUsername)) {
      return NextResponse.json({ ok: false, error: 'Некоректний Telegram bot username.' }, { status: 400 });
    }
    if (!isValidWebhookSecret(normalized.webhookSecret)) {
      return NextResponse.json({ ok: false, error: 'Webhook secret має містити 12-120 символів: латиниця, цифри, "_" або "-".' }, { status: 400 });
    }
    if (!isValidTelegramChatId(normalized.staffChatId)) {
      return NextResponse.json({ ok: false, error: 'Некоректний staff chat id.' }, { status: 400 });
    }
    if (!isValidTelegramChatId(normalized.adminChatId)) {
      return NextResponse.json({ ok: false, error: 'Некоректний admin chat id.' }, { status: 400 });
    }

    const saved = await saveInventoryTelegramSettingsToDb({
      ...normalized,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      ok: true,
      settings: saved,
      webhookUrl: buildInventoryWebhookUrl(saved)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
