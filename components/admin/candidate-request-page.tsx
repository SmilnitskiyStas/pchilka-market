'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { incomingRequestStatuses, type IncomingRequestRecord, type IncomingRequestStatus } from '@/lib/incoming-requests';

type TelegramMessage = { id: string; direction: 'incoming' | 'outgoing'; text: string; createdAt: string };
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('uk-UA'); }
function getTelegramChatId(request: IncomingRequestRecord | null) { const value = request?.metadata?.telegramChatId; return typeof value === 'string' && /^-?\d{5,20}$/.test(value) ? value : null; }
function statusLabel(status: IncomingRequestStatus) { return ({ new: 'Нова', in_progress: 'В роботі', done: 'Завершена', spam: 'Спам' } as Record<IncomingRequestStatus, string>)[status]; }

export default function CandidateRequestPage({ requestId }: { requestId: string }) {
  const [request, setRequest] = useState<IncomingRequestRecord | null>(null);
  const [conversation, setConversation] = useState<TelegramMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState('');

  async function loadRequest(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/admin/messages?id=${encodeURIComponent(requestId)}`, { cache: 'no-store' });
      const payload = await response.json() as { ok?: boolean; error?: string; request?: IncomingRequestRecord };
      if (!response.ok || !payload.ok || !payload.request) throw new Error(payload.error || 'Не вдалося завантажити заявку.');
      setRequest(payload.request);
      if (getTelegramChatId(payload.request)) await loadConversation(silent);
    } catch (loadError) { if (!silent) setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити заявку.'); }
    finally { if (!silent) setLoading(false); }
  }

  async function loadConversation(silent = false) {
    try {
      const response = await fetch(`/api/admin/messages/${encodeURIComponent(requestId)}/telegram`, { cache: 'no-store' });
      const payload = await response.json() as { ok?: boolean; error?: string; messages?: TelegramMessage[] };
      if (!response.ok || !payload.ok || !Array.isArray(payload.messages)) throw new Error(payload.error || 'Не вдалося завантажити діалог.');
      setConversation(payload.messages);
    } catch (loadError) { if (!silent) setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити діалог.'); }
  }

  useEffect(() => { void loadRequest(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadRequest(true); }, 5000); return () => window.clearInterval(timer); }, [requestId]);

  async function updateStatus(status: IncomingRequestStatus) {
    setUpdatingStatus(true); setError('');
    try { const response = await fetch('/api/admin/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Number(requestId), status }) }); const payload = await response.json() as { ok?: boolean; error?: string; request?: IncomingRequestRecord }; if (!response.ok || !payload.ok || !payload.request) throw new Error(payload.error || 'Не вдалося змінити статус.'); setRequest(payload.request); } catch (updateError) { setError(updateError instanceof Error ? updateError.message : 'Не вдалося змінити статус.'); } finally { setUpdatingStatus(false); }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true); setError('');
    try { const response = await fetch('/api/admin/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Number(requestId), message: reply }) }); const payload = await response.json() as { ok?: boolean; error?: string }; if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося надіслати повідомлення.'); setReply(''); await loadConversation(true); } catch (sendError) { setError(sendError instanceof Error ? sendError.message : 'Не вдалося надіслати повідомлення.'); } finally { setSending(false); }
  }

  if (loading) return <p className="text-sm text-slate-600">Завантаження заявки...</p>;
  if (!request) return <p className="text-sm text-red-700">{error || 'Заявку не знайдено.'}</p>;
  const telegramChatId = getTelegramChatId(request);

  return <div><Link href="/admin/messages" className="text-sm font-semibold text-brand hover:underline">← До списку заявок</Link><div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Заявка кандидата</p><h1 className="mt-1 text-2xl font-bold text-slate-900">{request.fullName || `Заявка #${request.id}`}</h1><p className="mt-1 text-sm text-slate-600">Створено: {formatDateTime(request.createdAt)}</p></div><label className="text-sm font-semibold text-slate-700">Статус<select value={request.status} disabled={updatingStatus} onChange={(event) => void updateStatus(event.target.value as IncomingRequestStatus)} className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:opacity-60">{incomingRequestStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label></div>{error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}<div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"><section className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="text-lg font-bold text-slate-900">Дані кандидата</h2><dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">{request.fullName ? <><dt className="text-slate-500">ПІБ</dt><dd className="font-medium text-slate-900">{request.fullName}</dd></> : null}{request.phone ? <><dt className="text-slate-500">Телефон</dt><dd className="font-medium text-slate-900">{request.phone}</dd></> : null}{request.email ? <><dt className="text-slate-500">Email</dt><dd className="font-medium text-slate-900">{request.email}</dd></> : null}{request.city ? <><dt className="text-slate-500">Місто</dt><dd className="font-medium text-slate-900">{request.city}</dd></> : null}{request.vacancy ? <><dt className="text-slate-500">Вакансія</dt><dd className="font-medium text-slate-900">{request.vacancy}</dd></> : null}{request.targetStore ? <><dt className="text-slate-500">Локація</dt><dd className="font-medium text-slate-900">{request.targetStore}</dd></> : null}</dl></div>{request.message ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="text-lg font-bold text-slate-900">Коментар до заявки</h2><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{request.message}</p></div> : null}{request.metadata ? <details className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Технічні метадані</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-slate-600">{JSON.stringify(request.metadata, null, 2)}</pre></details> : null}</section>{telegramChatId ? <section className="flex h-[calc(100vh-8rem)] min-h-[34rem] flex-col rounded-2xl border border-sky-200 bg-sky-50 p-4 xl:sticky xl:top-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Діалог у Telegram</h2><p className="mt-1 text-xs text-slate-600">Оновлюється кожні 5 секунд.</p></div><button type="button" onClick={() => void loadConversation()} className="text-sm font-semibold text-brand hover:underline">Оновити</button></div><div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-sky-100 bg-white p-3">{conversation.length === 0 ? <p className="text-sm text-slate-500">Повідомлень ще немає.</p> : conversation.map((item) => <div key={item.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${item.direction === 'incoming' ? 'mr-auto bg-slate-100 text-slate-800' : 'ml-auto bg-brand text-white'}`}><p className="whitespace-pre-wrap">{item.text}</p><p className={`mt-1 text-[10px] ${item.direction === 'incoming' ? 'text-slate-500' : 'text-white/80'}`}>{item.direction === 'incoming' ? 'Кандидат' : 'HR'} · {formatDateTime(item.createdAt)}</p></div>)}</div><div className="mt-3"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} maxLength={4000} placeholder="Напишіть повідомлення кандидату..." className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none focus:border-brand" /><button type="button" disabled={sending || !reply.trim()} onClick={() => void sendReply()} className="mt-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{sending ? 'Надсилання...' : 'Надіслати в Telegram'}</button></div></section> : <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Для цієї заявки Telegram-діалог недоступний.</section>}</div></div>;
}
