import { getDbPool } from '@/lib/db';
import { changeEngineeringTask, engineeringTask, engineeringTasks, engineeringUsers, type EngineeringTask } from '@/lib/engineering-repository';
import { readEngineeringSettings } from '@/lib/engineering-settings';
import type { RowDataPacket } from 'mysql2/promise';

export async function engineeringTelegram(token: string, method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const result = await response.json() as { ok?: boolean; result?: Record<string, unknown>; description?: string };
  if (!response.ok || !result.ok) throw new Error(`Telegram: ${String(result.description || response.status).replaceAll(token, '[token]')}`);
  return result.result || {};
}
export function engineeringCard(task: EngineeringTask) {
  const status = { new: 'Нове', in_progress: 'У роботі', done: 'Завершено' }[task.status];
  return `Тема запиту: ${task.subject}\nІдентифікатор відстеження: ${task.tracking_id}\nСтатус: ${status}${task.assignee_name ? `\nВідповідальний: ${task.assignee_name}` : ''}\n\n${task.body.slice(0, 2600)}${task.body.length > 2600 ? '\n… Повний текст — кнопка нижче.' : ''}`;
}
export function engineeringKeyboard(task: EngineeringTask) {
  const rows = task.status === 'new' ? [[{ text: 'Взяти в роботу', callback_data: `eng:claim:${task.id}` }]] : task.status === 'in_progress' ? [[{ text: 'Завершити', callback_data: `eng:done:${task.id}` }, { text: 'Повернути в чергу', callback_data: `eng:release:${task.id}` }]] : [];
  rows.push([{ text: 'Повний текст', callback_data: `eng:body:${task.id}` }, { text: 'Історія', callback_data: `eng:history:${task.id}` }]);
  rows.push([{ text: 'Усі завдання', callback_data: 'eng:list:all:0' }, { text: 'Мої завдання', callback_data: 'eng:list:mine:0' }]);
  return { inline_keyboard: rows };
}
export async function refreshEngineeringCards(taskId: number) {
  const settings = await readEngineeringSettings();
  const task = await engineeringTask(taskId);
  if (!task) return;
  const users = await engineeringUsers();
  const targets = new Set(users.filter(user => user.active && user.started).map(user => user.telegram_id));
  if (settings.chatId) targets.add(settings.chatId);
  const [deliveries] = await getDbPool().query<RowDataPacket[]>('SELECT d.chat_id, d.message_id, m.subject, m.body FROM engineering_deliveries d JOIN engineering_mail m ON m.id = d.mail_id WHERE m.task_id = ? AND d.part = 0 AND d.message_id > 0 ORDER BY d.mail_id DESC LIMIT 100', [taskId]);
  for (const delivery of deliveries) {
    if (!targets.has(String(delivery.chat_id))) continue;
    try { await engineeringTelegram(settings.botToken, 'editMessageText', { chat_id: delivery.chat_id, message_id: delivery.message_id, text: engineeringCard({ ...task, subject: delivery.subject, body: delivery.body }), reply_markup: engineeringKeyboard(task) }); }
    catch { /* A deleted message must not undo a committed assignment. */ }
  }
}
type Actor = { id: number; first_name?: string };
type Message = { chat: { id: number; type?: string; username?: string }; from?: Actor; text?: string; message_id?: number };
export type EngineeringUpdate = { message?: Message; callback_query?: { id: string; from: Actor; message?: Message; data?: string } };
export async function processEngineeringUpdate(update: EngineeringUpdate) {
  const settings = await readEngineeringSettings();
  if (!settings.enabled || !settings.botToken) return;
  const callback = update.callback_query;
  const incoming = callback?.message || update.message;
  const actor = callback?.from || update.message?.from;
  if (!incoming || !actor) return;
  const chatId = String(incoming.chat.id), actorId = String(actor.id);
  const send = (text: string, replyMarkup?: unknown) => engineeringTelegram(settings.botToken, 'sendMessage', { chat_id: chatId, text, reply_markup: replyMarkup });
  // /id reveals no ticket data and lets a user supply their numeric Telegram ID to an administrator.
  if (!callback && incoming.text === '/id') { await send(`Ваш Telegram ID: ${actorId}\nID чату: ${chatId}`); return; }
  const user = (await engineeringUsers()).find(item => item.telegram_id === actorId && item.active);
  const isConfiguredChat = chatId === settings.chatId || (Boolean(incoming.chat.username) && `@${incoming.chat.username}`.toLowerCase() === settings.chatId?.toLowerCase());
  if (!user || (incoming.chat.type !== 'private' && !isConfiguredChat)) {
    if (callback) await engineeringTelegram(settings.botToken, 'answerCallbackQuery', { callback_query_id: callback.id, text: 'Доступ відсутній. Зверніться до адміністратора.', show_alert: true });
    else await send('Для доступу попросіть адміністратора додати ваш Telegram ID. Команда /id покаже його.');
    return;
  }
  if (incoming.chat.type === 'private') await getDbPool().query('UPDATE engineering_users SET started = TRUE WHERE telegram_id = ? AND active = TRUE', [actorId]);
  const value = callback?.data || (incoming.text === 'Мої завдання' ? 'eng:list:mine:0' : incoming.text === 'Нові завдання' ? 'eng:list:new:0' : 'eng:list:all:0');
  const [, action, argument, rawPage] = value.split(':');
  if (callback) {
    if (['claim', 'release', 'done'].includes(action)) {
      try { await changeEngineeringTask(Number(argument), actorId, action); }
      catch (error) { await engineeringTelegram(settings.botToken, 'answerCallbackQuery', { callback_query_id: callback.id, text: error instanceof Error ? error.message : 'Помилка зміни завдання.', show_alert: true }); return; }
    }
    await engineeringTelegram(settings.botToken, 'answerCallbackQuery', { callback_query_id: callback.id });
  }
  if (action === 'list') {
    const filter = ['all', 'new', 'mine'].includes(argument) ? argument : 'all';
    const page = Math.floor(Math.min(100000, Math.max(0, Number(rawPage) || 0)));
    const tasks = await engineeringTasks(filter, actorId, page);
    const inline_keyboard = tasks.map(task => [{ text: `${task.status === 'new' ? '🆕' : task.status === 'done' ? '✅' : '🔧'} ${task.tracking_id}: ${task.subject}`.slice(0, 100), callback_data: `eng:view:${task.id}` }]);
    const pagination = [];
    if (page) pagination.push({ text: '← Назад', callback_data: `eng:list:${filter}:${page - 1}` });
    if (tasks.length === 20) pagination.push({ text: 'Далі →', callback_data: `eng:list:${filter}:${page + 1}` });
    if (pagination.length) inline_keyboard.push(pagination);
    inline_keyboard.push([{ text: 'Усі', callback_data: 'eng:list:all:0' }, { text: 'Нові', callback_data: 'eng:list:new:0' }, { text: 'Мої', callback_data: 'eng:list:mine:0' }]);
    await send(tasks.length ? 'Завдання інженерного відділу:' : 'Завдань у цьому списку немає.', { inline_keyboard });
    return;
  }
  const task = await engineeringTask(Number(argument));
  if (!task) { await send('Завдання не знайдено.'); return; }
  if (action === 'body') {
    for (let offset = 0; offset < task.body.length; offset += 3800) await send(task.body.slice(offset, offset + 3800));
    return;
  }
  if (action === 'history') {
    const [events] = await getDbPool().query<RowDataPacket[]>('SELECT actor_name, action, created_at FROM engineering_events WHERE task_id = ? ORDER BY id DESC LIMIT 20', [task.id]);
    const labels: Record<string, string> = { claim: 'взяв у роботу', release: 'повернув у чергу', done: 'завершив' };
    const history = `Історія ${task.tracking_id}\n${events.map(event => `${new Date(event.created_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' })} — ${event.actor_name}: ${labels[event.action]}`).join('\n') || 'Змін статусу ще немає.'}`;
    for (let offset = 0; offset < history.length; offset += 3800) await send(history.slice(offset, offset + 3800));
    return;
  }
  await send(engineeringCard(task), engineeringKeyboard(task));
  if (['claim', 'release', 'done'].includes(action)) await refreshEngineeringCards(task.id);
}
