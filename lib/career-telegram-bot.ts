import { createIncomingRequestInDb } from '@/lib/incoming-requests-repository';
import { getCareerTelegramSettings, listCareerTelegramCities, listCareerTelegramStores } from '@/lib/career-telegram-settings-repository';
import { deleteCareerTelegramSession, getCareerTelegramSession, saveCareerTelegramSession, type CareerTelegramSession } from '@/lib/career-telegram-sessions-repository';
import { addCareerTelegramMessage, findLatestCareerTelegramRequestId } from '@/lib/career-telegram-messages-repository';

type TelegramMessage = { chat?: { id?: number | string }; from?: { id?: number | string; username?: string }; text?: string; contact?: { phone_number?: string; user_id?: number | string } };
type TelegramUpdate = { message?: TelegramMessage };
type TelegramWebhookInfo = { url?: string; pending_update_count?: number; last_error_message?: string };

async function callTelegram(token: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !payload?.ok) throw new Error(payload?.description || `Telegram ${method} failed.`);
}

async function message(token: string, chatId: string, text: string, replyMarkup?: Record<string, unknown>) { await callTelegram(token, 'sendMessage', { chat_id: chatId, text, reply_markup: replyMarkup }); }
const cancelKeyboard = { keyboard: [[{ text: '❌ Скасувати' }]], resize_keyboard: true, one_time_keyboard: false };
const menuKeyboard = { keyboard: [[{ text: 'Заповнити анкету' }]], resize_keyboard: true };
function clean(value: string, max: number) { return value.trim().replace(/\s+/g, ' ').slice(0, max); }
function phoneIsValid(value: string) { const length = value.replace(/\D/g, '').length; return length >= 10 && length <= 15; }

function freshSession(chatId: string, userId: string, username: string): CareerTelegramSession { return { chatId, step: 'phone', phone: '', fullName: '', city: '', storeLabel: '', vacancy: '', telegramUserId: userId, telegramUsername: username }; }
function phoneKeyboard() { return { keyboard: [[{ text: 'Поділитися телефоном', request_contact: true }], [{ text: 'Пропустити номер' }, { text: '❌ Скасувати' }]], resize_keyboard: true, one_time_keyboard: true }; }
function vacanciesKeyboard(vacancies: string[]) { return { keyboard: [...vacancies.map((vacancy) => [{ text: vacancy }]), [{ text: '❌ Скасувати' }]], resize_keyboard: true, one_time_keyboard: true }; }

export async function processCareerTelegramUpdate(update: TelegramUpdate) {
  const settings = await getCareerTelegramSettings();
  const incoming = update.message;
  const chatId = String(incoming?.chat?.id ?? '');
  if (!settings.botToken || !chatId) return { ignored: true };
  const text = clean(incoming?.text ?? '', 500);
  const userId = String(incoming?.from?.id ?? '');
  const username = clean(incoming?.from?.username ?? '', 64);

  if (text === '/id') {
    await message(settings.botToken, chatId, `ID цього чату: ${chatId}`);
    return { handled: 'chat-id' };
  }
  if (!settings.enabled) return { ignored: true };
  if (text === '/start' || text.startsWith('/start ') || text === '❌ Скасувати') {
    await deleteCareerTelegramSession(chatId);
    await message(settings.botToken, chatId, 'Оберіть дію 👇', menuKeyboard);
    return { handled: 'menu' };
  }
  if (text === 'Заповнити анкету') {
    await saveCareerTelegramSession(freshSession(chatId, userId, username));
    await message(settings.botToken, chatId, 'Поділіться телефоном, або пропустіть цей крок — тоді ми зможемо відповісти вам лише тут, у Telegram 👇', phoneKeyboard());
    return { handled: 'phone-requested' };
  }
  const session = await getCareerTelegramSession(chatId);
  if (!session) {
    const requestId = text ? await findLatestCareerTelegramRequestId(chatId) : null;
    if (requestId) {
      await addCareerTelegramMessage({ requestId, chatId, direction: 'incoming', text });
      await message(settings.botToken, chatId, 'Дякуємо, HR отримав ваше повідомлення та відповість тут у Telegram.', menuKeyboard);
      return { handled: 'candidate-message', requestId };
    }
    await message(settings.botToken, chatId, 'Оберіть дію 👇', menuKeyboard);
    return { handled: 'menu-reminder' };
  }
  if (session.step === 'phone') {
    if (incoming?.contact?.user_id != null && userId && String(incoming.contact.user_id) !== userId) {
      await message(settings.botToken, chatId, 'Надішліть, будь ласка, свій власний номер через кнопку нижче.', phoneKeyboard());
      return { handled: 'foreign-contact' };
    }
    if (text === 'Пропустити номер') {
      await saveCareerTelegramSession({ ...session, phone: '', step: 'full_name' });
      await message(settings.botToken, chatId, "Прізвище, ім'я, по батькові", cancelKeyboard);
      return { handled: 'phone-skipped' };
    }
    const phone = clean(incoming?.contact?.phone_number ?? text, 60);
    if (!phoneIsValid(phone)) { await message(settings.botToken, chatId, 'Будь ласка, надішліть номер через кнопку «Поділитися телефоном».', cancelKeyboard); return { handled: 'phone-invalid' }; }
    await saveCareerTelegramSession({ ...session, phone, step: 'full_name' });
    await message(settings.botToken, chatId, "Прізвище, ім'я, по батькові", cancelKeyboard);
    return { handled: 'name-requested' };
  }
  if (session.step === 'full_name') {
    if (text.length < 3) { await message(settings.botToken, chatId, "Вкажіть, будь ласка, ваше прізвище та ім'я.", cancelKeyboard); return { handled: 'name-invalid' }; }
    await saveCareerTelegramSession({ ...session, fullName: clean(text, 120), step: 'city' });
    const cities = await listCareerTelegramCities();
    const cityButtons = (cities.length ? cities : settings.cities).map((city) => ({ text: city }));
    const keyboard = cityButtons.reduce<Array<Array<{ text: string }>>>((rows, button, index) => { if (index % 2 === 0) rows.push([button]); else rows[rows.length - 1].push(button); return rows; }, []);
    keyboard.push([{ text: '❌ Скасувати' }]);
    await message(settings.botToken, chatId, 'Місто', { keyboard, resize_keyboard: true, one_time_keyboard: true });
    return { handled: 'city-requested' };
  }
  if (session.step === 'city') {
    const city = clean(text, 120);
    if (!city || city === '❌ Скасувати') return { handled: 'cancelled' };
    const stores = await listCareerTelegramStores(city);
    if (!stores.length) { await message(settings.botToken, chatId, 'У цьому місті поки немає активних магазинів. Оберіть інше місто.', cancelKeyboard); return { handled: 'stores-missing' }; }
    await saveCareerTelegramSession({ ...session, city, step: 'store' });
    await message(settings.botToken, chatId, 'Оберіть магазин, у якому бажаєте працювати', { keyboard: [...stores.map((store) => [{ text: store.label }]), [{ text: '❌ Скасувати' }]], resize_keyboard: true, one_time_keyboard: true });
    return { handled: 'store-requested' };
  }
  if (session.step === 'store') {
    const stores = await listCareerTelegramStores(session.city);
    const selectedStore = stores.find((store) => store.label === text);
    if (!selectedStore) { await message(settings.botToken, chatId, 'Оберіть, будь ласка, магазин кнопкою нижче.', { keyboard: [...stores.map((store) => [{ text: store.label }]), [{ text: '❌ Скасувати' }]], resize_keyboard: true }); return { handled: 'store-invalid' }; }
    const storeLabel = `${selectedStore.name}${selectedStore.addressLine ? ` — ${selectedStore.addressLine}` : ''}`;
    if (!settings.vacancies.length) { await message(settings.botToken, chatId, 'Наразі перелік вакансій оновлюється. Спробуйте, будь ласка, трохи пізніше.', menuKeyboard); await deleteCareerTelegramSession(chatId); return { handled: 'vacancies-missing' }; }
    await saveCareerTelegramSession({ ...session, storeLabel, step: 'vacancy' });
    await message(settings.botToken, chatId, 'Оберіть вакансію, яка вас цікавить', vacanciesKeyboard(settings.vacancies));
    return { handled: 'vacancy-requested' };
  }
  const vacancy = settings.vacancies.find((item) => item === text);
  if (!vacancy) {
    const requestId = text ? await findLatestCareerTelegramRequestId(chatId) : null;
    if (requestId) {
      await addCareerTelegramMessage({ requestId, chatId, direction: 'incoming', text });
      await deleteCareerTelegramSession(chatId);
      await message(settings.botToken, chatId, 'Дякуємо, HR отримав ваше повідомлення та відповість тут у Telegram.', menuKeyboard);
      return { handled: 'candidate-message', requestId };
    }
    await message(settings.botToken, chatId, 'Оберіть, будь ласка, вакансію кнопкою нижче.', vacanciesKeyboard(settings.vacancies));
    return { handled: 'vacancy-invalid' };
  }
  const created = await createIncomingRequestInDb({ requestType: 'career_application', fullName: session.fullName, phone: session.phone, city: session.city, vacancy, targetStore: session.storeLabel, message: `Анкета з Telegram. Обраний магазин: ${session.storeLabel}. Вакансія: ${vacancy}.`, sourcePage: 'telegram://career-bot', metadata: { store: session.storeLabel, vacancy, channel: 'telegram', telegramChatId: chatId, telegramUserId: session.telegramUserId, telegramUsername: session.telegramUsername, telegramContactAvailable: true } });
  await addCareerTelegramMessage({ requestId: created.id, chatId, direction: 'outgoing', text: 'Дякуємо за відповіді! Ми вам зателефонуємо найближчим часом.' });
  await deleteCareerTelegramSession(chatId);
  if (settings.hrChatId) {
    try { await message(settings.botToken, settings.hrChatId, `📩 Нова заявка #${created.id} з Telegram\n\nПІБ: ${session.fullName}\nТелефон: ${session.phone || 'не вказано'}\nМісто: ${session.city}\nМагазин: ${session.storeLabel}\nВакансія: ${vacancy}\nЗв’язок у Telegram: доступний через бота${session.telegramUsername ? ` (@${session.telegramUsername})` : ''}`); }
    catch (error) { console.error('Could not send career application to HR chat:', error); }
  }
  await message(settings.botToken, chatId, 'Дякуємо за відповіді! Ми вам зателефонуємо найближчим часом.', menuKeyboard);
  return { handled: 'completed', requestId: created.id };
}

export async function sendCareerTelegramCandidateMessage(chatId: string, text: string) {
  const settings = await getCareerTelegramSettings();
  if (!settings.enabled || !settings.botToken) throw new Error('Бот вакансій не налаштований або вимкнений.');
  const normalizedChatId = chatId.trim();
  const normalizedText = clean(text, 4000);
  if (!/^-?\d{5,20}$/.test(normalizedChatId) || !normalizedText) throw new Error('Некоректні дані для повідомлення кандидату.');
  await message(settings.botToken, normalizedChatId, normalizedText);
}

export async function registerCareerTelegramWebhook() {
  const settings = await getCareerTelegramSettings();
  const url = settings.publicBaseUrl ? `${settings.publicBaseUrl}/api/career-telegram/webhook` : '';
  if (!settings.botToken || !settings.webhookSecret || !url) throw new Error('Заповніть токен, secret і публічну адресу сайту.');
  await callTelegram(settings.botToken, 'setWebhook', { url, secret_token: settings.webhookSecret, allowed_updates: ['message'] });
  await callTelegram(settings.botToken, 'setMyCommands', { commands: [{ command: 'start', description: 'Почати заповнення анкети' }, { command: 'id', description: 'Показати ID поточного чату' }] });
  await callTelegram(settings.botToken, 'setMyDescription', { description: '🐝 Бот вакансій «Пчілка Маркет»\n\nТут ви швидко та зручно залишите заявку на вакансію в нашій команді. Анкета займе близько однієї хвилини, а HR зателефонує вам найближчим часом.' });
  await callTelegram(settings.botToken, 'setMyShortDescription', { short_description: 'Вакансії та анкета кандидата Пчілка Маркет.' });
  return { webhookUrl: url };
}

export async function getCareerTelegramWebhookInfo() {
  const settings = await getCareerTelegramSettings();
  const webhookUrl = settings.publicBaseUrl ? `${settings.publicBaseUrl}/api/career-telegram/webhook` : '';
  if (!settings.botToken) return { configured: false, webhookUrl, info: null };
  const response = await fetch(`https://api.telegram.org/bot${settings.botToken}/getWebhookInfo`);
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: TelegramWebhookInfo; description?: string } | null;
  if (!response.ok || !payload?.ok) throw new Error(payload?.description || 'Не вдалося отримати статус webhook від Telegram.');
  const info = payload.result ?? null;
  return {
    configured: Boolean(info?.url),
    webhookUrl,
    info: info ? { url: info.url ?? '', pendingUpdateCount: Number(info.pending_update_count ?? 0), lastErrorMessage: info.last_error_message ?? '' } : null
  };
}
