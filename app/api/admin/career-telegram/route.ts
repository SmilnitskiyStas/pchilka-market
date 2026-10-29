import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminSessionFromRequest, isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { buildCareerTelegramStartUrl, buildCareerTelegramWebhookUrl, isValidTelegramBotToken, isValidTelegramBotUsername, isValidTelegramChatId, isValidWebhookSecret, normalizeCareerTelegramSettings, type CareerTelegramSettings } from '@/lib/career-telegram-settings';
import { getCareerTelegramSettings, listCareerTelegramCities, saveCareerTelegramSettings } from '@/lib/career-telegram-settings-repository';
import { getCareerTelegramWebhookInfo, registerCareerTelegramWebhook } from '@/lib/career-telegram-bot';
export const runtime = 'nodejs';
function isSystemAdministrator(request: Request) { return getAdminSessionFromRequest(request)?.role === 'admin'; }

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  const settings = await getCareerTelegramSettings();
  if (!isSystemAdministrator(request)) return NextResponse.json({ ok: true, canManageSystem: false, vacancies: settings.vacancies });
  const cities = await listCareerTelegramCities();
  const settingsWithStoreCities = { ...settings, cities: cities.length ? cities : settings.cities };
  return NextResponse.json({ ok: true, canManageSystem: true, settings: settingsWithStoreCities, webhookUrl: buildCareerTelegramWebhookUrl(settingsWithStoreCities), startUrl: buildCareerTelegramStartUrl(settingsWithStoreCities) });
}
export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  if (!isSystemAdministrator(request)) return NextResponse.json({ ok: false, error: 'Системні налаштування бота доступні лише адміністратору.' }, { status: 403 });
  try { const body = await request.json() as { settings?: Partial<CareerTelegramSettings> }; const current = await getCareerTelegramSettings(); const settings = normalizeCareerTelegramSettings({ ...body.settings, vacancies: current.vacancies, updatedAt: new Date().toISOString() }); const invalid = [!isValidTelegramBotToken(settings.botToken) && 'Bot token', !isValidTelegramBotUsername(settings.botUsername) && 'Username бота', !isValidTelegramChatId(settings.hrChatId) && 'ID HR-чату', !isValidWebhookSecret(settings.webhookSecret) && 'Webhook secret'].filter(Boolean); if (invalid.length) return NextResponse.json({ ok: false, error: `Некоректні поля: ${invalid.join(', ')}.` }, { status: 400 }); const saved = await saveCareerTelegramSettings(settings); revalidatePath('/career'); return NextResponse.json({ ok: true, settings: saved, webhookUrl: buildCareerTelegramWebhookUrl(saved), startUrl: buildCareerTelegramStartUrl(saved) }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 }); }
}
export async function PATCH(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const body = await request.json() as { vacancies?: unknown };
    const current = await getCareerTelegramSettings();
    if (!Array.isArray(body.vacancies) || body.vacancies.some((item) => typeof item !== 'string')) return NextResponse.json({ ok: false, error: 'Передайте список вакансій.' }, { status: 400 });
    const vacancies = body.vacancies;
    const settings = normalizeCareerTelegramSettings({ ...current, vacancies, updatedAt: new Date().toISOString() });
    const saved = await saveCareerTelegramSettings(settings);
    revalidatePath('/career');
    return NextResponse.json({ ok: true, vacancies: saved.vacancies });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 }); }
}
export async function POST(request: Request) { if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse(); if (!isSystemAdministrator(request)) return NextResponse.json({ ok: false, error: 'Керування webhook доступне лише адміністратору.' }, { status: 403 }); try { const action = (await request.json() as { action?: string }).action; if (action === 'register-webhook') return NextResponse.json({ ok: true, ...(await registerCareerTelegramWebhook()) }); if (action === 'check-webhook') return NextResponse.json({ ok: true, ...(await getCareerTelegramWebhookInfo()) }); return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 }); } }
