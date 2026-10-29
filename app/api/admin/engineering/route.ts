import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { getAdminSessionFromRequest, isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getDbPool } from '@/lib/db';
import { engineeringTasks, engineeringUsers, ensureEngineeringSchema, resetEngineeringTask } from '@/lib/engineering-repository';
import { publicEngineeringSettings, readEngineeringSettings, saveEngineeringSettings } from '@/lib/engineering-settings';
import { engineeringTelegram, refreshEngineeringCards } from '@/lib/engineering-telegram';
import { runEngineeringMail } from '@/lib/engineering-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const authorized = (request: Request) => isAdminRequestAuthorized(request) && getAdminSessionFromRequest(request)?.role === 'admin';
function failure() { return NextResponse.json({ ok: false, error: 'Не вдалося виконати дію. Перевірте підключення до БД, IMAP і Telegram та права запису до .env.' }, { status: 500 }); }
export async function GET(request: Request) {
  if (!authorized(request)) return unauthorizedAdminResponse();
  try {
    const url = new URL(request.url);
    const page = Math.floor(Math.max(0, Math.min(100000, Number(url.searchParams.get('page')) || 0)));
    const [settings, users, tasks] = await Promise.all([readEngineeringSettings(), engineeringUsers(), engineeringTasks('all', '', page)]);
    const [events] = await getDbPool().query<RowDataPacket[]>('SELECT * FROM engineering_events ORDER BY id DESC LIMIT 50');
    return NextResponse.json({ ok: true, settings: publicEngineeringSettings(settings), users, tasks, events }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return failure(); }
}
export async function PUT(request: Request) {
  if (!authorized(request)) return unauthorizedAdminResponse();
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'Некоректні дані.' }, { status: 400 }); }
  try { return NextResponse.json({ ok: true, settings: publicEngineeringSettings(await saveEngineeringSettings(body)) }); }
  catch (error) {
    if (error instanceof Error && !('code' in error)) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return failure();
  }
}
export async function POST(request: Request) {
  if (!authorized(request)) return unauthorizedAdminResponse();
  try {
    const body = await request.json();
    if (body.action === 'sync') return NextResponse.json({ ok: true, result: await runEngineeringMail() });
    if (body.action === 'release-task') {
      if (!Number.isSafeInteger(body.taskId) || body.taskId < 1) return NextResponse.json({ ok: false }, { status: 400 });
      await ensureEngineeringSchema();
      await resetEngineeringTask(body.taskId, getAdminSessionFromRequest(request)!.username);
      await refreshEngineeringCards(body.taskId);
      return NextResponse.json({ ok: true });
    }
    const settings = await readEngineeringSettings();
    if (body.action === 'webhook') {
      if (!settings.publicBaseUrl || !settings.webhookSecret || !settings.botToken) return NextResponse.json({ ok: false, error: 'Спочатку збережіть HTTPS-адресу й токен бота.' }, { status: 400 });
      const bot = await engineeringTelegram(settings.botToken, 'getMe', {});
      if (bot.username !== 'engineering_dep_pchilka_bot') return NextResponse.json({ ok: false, error: 'Токен належить іншому боту.' }, { status: 400 });
      await engineeringTelegram(settings.botToken, 'setWebhook', { url: `${settings.publicBaseUrl}/api/engineering/webhook`, secret_token: settings.webhookSecret, allowed_updates: ['message', 'callback_query'] });
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'user') {
      const id = String(body.telegramId || ''), name = String(body.name || '').trim();
      if (!/^\d{1,20}$/.test(id) || !name || name.length > 160) return NextResponse.json({ ok: false, error: 'Вкажіть числовий Telegram ID та ім’я до 160 символів.' }, { status: 400 });
      await ensureEngineeringSchema();
      await getDbPool().query('INSERT INTO engineering_users (telegram_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), active = TRUE', [id, name]);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'Невідома дія.' }, { status: 400 });
  } catch { return failure(); }
}
export async function DELETE(request: Request) {
  if (!authorized(request)) return unauthorizedAdminResponse();
  try {
    const { telegramId } = await request.json();
    await ensureEngineeringSchema();
    // Keep the record for attribution; all bot actions and future deliveries check active.
    await getDbPool().query('UPDATE engineering_users SET active = FALSE, started = FALSE WHERE telegram_id = ?', [String(telegramId)]);
    return NextResponse.json({ ok: true });
  } catch { return failure(); }
}
