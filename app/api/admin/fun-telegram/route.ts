import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { registerFunTelegramWebhook } from '@/lib/fun-telegram-bot';
import {
  buildFunTelegramWebhookUrl, isValidTelegramBotToken, isValidTelegramBotUsername, isValidTelegramChatId,
  isValidWebhookSecret, normalizeFunTelegramSettings, type FunTelegramSettings
} from '@/lib/fun-telegram-settings';
import { getFunTelegramSettings, saveFunTelegramSettings } from '@/lib/fun-telegram-settings-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  const settings = await getFunTelegramSettings();
  return NextResponse.json({ ok: true, settings, webhookUrl: buildFunTelegramWebhookUrl(settings) });
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const body = (await request.json()) as { settings?: Partial<FunTelegramSettings> };
    const settings = normalizeFunTelegramSettings({ ...body.settings, updatedAt: new Date().toISOString() });
    if (!isValidTelegramBotToken(settings.botToken) || !isValidTelegramBotUsername(settings.botUsername) || !isValidWebhookSecret(settings.webhookSecret) || !isValidTelegramChatId(settings.allowedChatId)) {
      return NextResponse.json({ ok: false, error: 'Перевірте формат налаштувань Telegram.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, settings: await saveFunTelegramSettings(settings), webhookUrl: buildFunTelegramWebhookUrl(settings) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const body = (await request.json()) as { action?: string };
    if (body.action !== 'register-webhook') return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await registerFunTelegramWebhook()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
