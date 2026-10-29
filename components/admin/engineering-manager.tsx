'use client';
import { useCallback, useEffect, useState } from 'react';

type Settings = { enabled: boolean; mailHost: string; mailPort: number; mailUser: string; mailFolder: string; chatId: string; publicBaseUrl: string; passwordConfigured: boolean; tokenConfigured: boolean };
type User = { telegram_id: string; name: string; active: number; started: number };
type Task = { id: number; tracking_id: string; subject: string; body: string; status: string; assignee_name: string | null };
type Event = { id: number; task_id: number; actor_name: string; action: string; created_at: string };
type Invite = { id: number; name: string; used_by: string | null; revoked: number; expired: number };
type InvitationLink = { id: number; name: string; url: string };
const statusLabels: Record<string, string> = { new: 'Нове', in_progress: 'У роботі', done: 'Завершено' };
const actionLabels: Record<string, string> = { claim: 'взяв у роботу', release: 'повернув у чергу', done: 'завершив' };
const inputClass = 'mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm';
const buttonClass = 'rounded-xl border border-brand/40 px-4 py-2 text-sm font-medium disabled:opacity-50';
export default function EngineeringManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mailPassword, setMailPassword] = useState(''), [botToken, setBotToken] = useState('');
  const [users, setUsers] = useState<User[]>([]), [tasks, setTasks] = useState<Task[]>([]), [events, setEvents] = useState<Event[]>([]);
  const [name, setName] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]), [invitation, setInvitation] = useState<InvitationLink | null>(null);
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [page, setPage] = useState(0);
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/engineering?page=${page}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Не вдалося завантажити дані.');
    setSettings(data.settings); setUsers(data.users); setTasks(data.tasks); setEvents(data.events); setInvites(data.invites || []);
    setInvitation(current => {
      const invite = data.invites?.find((item: Invite) => item.id === current?.id);
      return invite && (invite.used_by || invite.revoked || invite.expired) ? null : current;
    });
  }, [page]);
  useEffect(() => { load().catch(error => setNotice(error.message)); }, [load]);
  async function execute(method: string, body: unknown, message: string) {
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/admin/engineering', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не вдалося виконати дію.');
      if (method === 'PUT') { setMailPassword(''); setBotToken(''); }
      if (data.invitation) setInvitation(data.invitation);
      if (method === 'DELETE' && (body as { inviteId?: number }).inviteId === invitation?.id) setInvitation(null);
      await load();
      setNotice(data.result ? (data.result.skipped ? 'Перевірку пропущено: модуль вимкнений або вже перевіряє пошту.' : `${data.result.mailFailed ? 'Не вдалося перевірити пошту — перевірте IMAP-сервер, логін і пароль. ' : ''}Опрацьовано листів: ${data.result.imported}. Надіслано повідомлень: ${data.result.sent}. Невдалих доставок: ${data.result.failed || 0} (будуть повторені).`) : message);
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Помилка.'); return false; }
    finally { setBusy(false); }
  }
  const field = (key: 'mailHost' | 'mailUser' | 'mailFolder' | 'chatId' | 'publicBaseUrl', label: string, placeholder = '') => <label className="block text-sm">{label}<input className={inputClass} value={settings?.[key] || ''} placeholder={placeholder} onChange={event => setSettings(current => current && ({ ...current, [key]: event.target.value }))} /></label>;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Інженерний Help Desk</h1><p className="mt-2 text-sm text-gray-600">Листи від legion_admin@legion2015.com → <a className="text-brand underline" href="https://t.me/engineering_dep_pchilka_bot" target="_blank" rel="noreferrer">@engineering_dep_pchilka_bot</a>. Тема, ідентифікатор відстеження та текст запиту.</p></div>
    {notice && <p role="status" className="rounded-xl bg-gray-100 p-3 text-sm">{notice}</p>}
    {!settings ? <p>Налаштування ще не завантажено.</p> : <>
      <form className="space-y-4 rounded-2xl border p-4" onSubmit={event => { event.preventDefault(); void execute('PUT', { ...settings, mailPassword, botToken }, 'Налаштування збережено в .env.'); }}>
        <h2 className="text-lg font-semibold">Пошта та Telegram</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {field('mailUser', 'Логін пошти')}{field('mailHost', 'IMAP-сервер', 'Адреса сервера від поштового адміністратора')}
          <label className="text-sm">Пароль пошти<input type="password" autoComplete="new-password" className={inputClass} value={mailPassword} placeholder={settings.passwordConfigured ? 'Збережено. Залиште порожнім, щоб не змінювати' : 'Введіть пароль'} onChange={event => setMailPassword(event.target.value)} /></label>
          <label className="text-sm">Порт IMAP (TLS)<input type="number" min="1" max="65535" className={inputClass} value={settings.mailPort} onChange={event => setSettings({ ...settings, mailPort: Number(event.target.value) })} /></label>
          {field('mailFolder', 'Поштова папка')}
          <label className="text-sm">Токен engineering_dep_pchilka_bot<input type="password" autoComplete="new-password" className={inputClass} value={botToken} placeholder={settings.tokenConfigured ? 'Токен збережено' : 'Токен із BotFather'} onChange={event => setBotToken(event.target.value)} /></label>
          {field('publicBaseUrl', 'Публічна HTTPS-адреса сайту', 'https://pchilka-market.ua')}{field('chatId', 'Канал / група (необов’язково)', '-100… або @назва_каналу')}
        </div>
        <p className="text-sm text-gray-600">Без каналу сповіщення надходять особисто працівникам, які активували персональне запрошення. Для каналу додайте бота адміністратором. Команда /id потрібна лише для визначення ID спільного чату.</p>
        <p className="text-sm text-gray-600">Початкова перевірка імпортує листи за останні 7 днів, наступні — нові листи. Налаштування набувають чинності без перезапуску.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled} onChange={event => setSettings({ ...settings, enabled: event.target.checked })} />Увімкнути отримання листів і Telegram-бота</label>
        <div className="flex flex-wrap gap-2"><button disabled={busy} className={`${buttonClass} bg-brand text-white`}>Зберегти</button><button type="button" disabled={busy} className={buttonClass} onClick={() => void execute('POST', { action: 'webhook' }, 'Telegram підключено. Працівники можуть відкрити бота.')}>Підключити Telegram</button><button type="button" disabled={busy} className={buttonClass} onClick={() => void execute('POST', { action: 'sync' }, '')}>Перевірити пошту зараз</button></div>
      </form>
      <section className="space-y-3 rounded-2xl border p-4"><h2 className="text-lg font-semibold">Працівники з доступом</h2>
        <p className="text-sm text-gray-600">Вкажіть ім’я та створіть персональне посилання. Надішліть його працівнику: після натискання «Почати» в Telegram доступ активується автоматично. Telegram ID вводити не потрібно.</p>
        <form className="grid items-end gap-3 md:grid-cols-[1fr_auto]" onSubmit={async event => { event.preventDefault(); if (await execute('POST', { action: 'invite', name }, 'Запрошення створено. Скопіюйте посилання та надішліть працівнику.')) setName(''); }}>
          <label className="text-sm">Ім’я працівника<input required maxLength={160} className={inputClass} value={name} onChange={event => setName(event.target.value)} /></label>
          <button className={buttonClass} disabled={busy}>Створити запрошення</button>
        </form>
        {invitation && <div className="space-y-2 rounded-xl bg-green-50 p-3 text-sm"><p className="font-medium">Запрошення для {invitation.name}</p><p>Одноразове, діє 7 днів. Посилання показується лише після створення; передайте його особисто цьому працівнику.</p><label className="block">Посилання запрошення<input readOnly className={inputClass} value={invitation.url} onFocus={event => event.target.select()} /></label><button type="button" className={buttonClass} onClick={async () => { try { await navigator.clipboard.writeText(invitation.url); setNotice('Посилання скопійовано.'); } catch { setNotice('Виділіть і скопіюйте посилання з поля вручну.'); } }}>Скопіювати посилання</button></div>}
        <h3 className="pt-2 font-medium">Запрошення</h3>
        {invites.length === 0 && <p className="text-sm text-gray-600">Запрошень поки немає.</p>}
        {invites.map(invite => <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm"><span>{invite.name} · {invite.revoked ? 'Скасоване' : invite.used_by ? 'Активоване' : invite.expired ? 'Строк дії минув' : 'Очікує приєднання'}</span>{!invite.revoked && !invite.used_by && !invite.expired && <button className={buttonClass} disabled={busy} onClick={() => void execute('DELETE', { inviteId: invite.id }, 'Запрошення скасовано.')}>Скасувати запрошення</button>}</div>)}
        <h3 className="pt-2 font-medium">Працівники</h3>
        {users.map(user => <div key={user.telegram_id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm"><span>{user.name} · {!user.active ? 'Доступ видалено' : user.started ? 'Отримує сповіщення' : 'Очікує запуску бота'}</span>{user.active ? <button className={buttonClass} disabled={busy} onClick={() => void execute('DELETE', { telegramId: user.telegram_id }, 'Доступ видалено. Історію виконання збережено.')}>Видалити доступ</button> : <button className={buttonClass} disabled={busy} onClick={() => { setName(user.name); setNotice('Ім’я підставлено у форму. Створіть і надішліть нове запрошення для відновлення доступу.'); }}>Підготувати нове запрошення</button>}</div>)}
      </section>
      <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Завдання</h2><button className={buttonClass} disabled={busy} onClick={() => void load().catch(error => setNotice(error.message))}>Оновити</button></div>
        {tasks.length === 0 && <p className="text-sm text-gray-600">На цій сторінці завдань немає.</p>}
        {tasks.map(task => <details key={task.id} className="rounded-xl border p-3"><summary className="cursor-pointer text-sm"><strong>{task.tracking_id}</strong> · {task.subject}<span className="mt-1 block text-gray-600">{statusLabels[task.status]} · {task.assignee_name || 'Відповідального ще немає'}</span></summary><p className="my-3 whitespace-pre-wrap break-words text-sm">{task.body}</p>{task.status === 'in_progress' && <button disabled={busy} className={buttonClass} onClick={() => void execute('POST', { action: 'release-task', taskId: task.id }, 'Завдання повернуто в чергу. Дію записано в історії.')}>Повернути в чергу</button>}</details>)}
        <div className="flex items-center gap-3"><button className={buttonClass} disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Назад</button><span className="text-sm">Сторінка {page + 1}</span><button className={buttonClass} disabled={tasks.length < 20 || busy} onClick={() => setPage(page + 1)}>Далі</button></div>
      </section>
      <section><h2 className="mb-3 text-lg font-semibold">Останні дії працівників</h2>{events.map(event => <p key={event.id} className="border-t py-2 text-sm">{new Date(event.created_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' })} · #{event.task_id} · {event.actor_name}: {actionLabels[event.action] || event.action}</p>)}</section>
    </>}
  </div>;
}
