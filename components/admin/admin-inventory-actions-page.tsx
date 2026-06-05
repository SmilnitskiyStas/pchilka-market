'use client';

import { useEffect, useState } from 'react';

import type { InventoryEmployeeActionsDashboard } from '@/lib/inventory-employee-actions-repository';
import type { StoreRecord } from '@/lib/store-types';

type StoresPayload = {
  ok?: boolean;
  stores?: StoreRecord[];
  error?: string;
};

type ActionsPayload = InventoryEmployeeActionsDashboard & {
  ok?: boolean;
  error?: string;
};

function formatDateTime(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
}

function formatDiscussionStatus(status: 'open' | 'closed') {
  return status === 'closed' ? 'Закрито' : 'Відкрите';
}

function getActionBadgeLabel(source: 'batch_check' | 'activity_log') {
  return source === 'batch_check' ? 'Перевірка партії' : 'Журнал дій';
}

function storeLabel(store: StoreRecord) {
  return [store.storeCode, store.city, store.addressLine].filter(Boolean).join(' | ') || store.name || 'Магазин';
}

export default function AdminInventoryActionsPage() {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [dashboard, setDashboard] = useState<InventoryEmployeeActionsDashboard | null>(null);
  const [storeId, setStoreId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(80);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const formatted = `${yyyy}-${mm}-${dd}`;
    setDateFrom(formatted);
    setDateTo(formatted);
  }, []);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        if (storeId.trim()) params.set('storeId', storeId.trim());
        if (dateFrom.trim()) params.set('dateFrom', dateFrom.trim());
        if (dateTo.trim()) params.set('dateTo', dateTo.trim());

        const [storesResponse, actionsResponse] = await Promise.all([
          fetch('/api/admin/stores', { cache: 'no-store' }),
          fetch(`/api/admin/inventory/actions?${params.toString()}`, { cache: 'no-store' })
        ]);

        const storesPayload = (await storesResponse.json()) as StoresPayload;
        const actionsPayload = (await actionsResponse.json()) as ActionsPayload;

        if (!storesResponse.ok || !storesPayload.ok || !Array.isArray(storesPayload.stores)) {
          throw new Error(storesPayload.error || 'Не вдалося завантажити магазини.');
        }
        if (!actionsResponse.ok || !actionsPayload.ok) {
          throw new Error(actionsPayload.error || 'Не вдалося завантажити дії працівників.');
        }

        if (!cancelled) {
          setStores(storesPayload.stores);
          setDashboard({
            actions: Array.isArray(actionsPayload.actions) ? actionsPayload.actions : [],
            discussions: Array.isArray(actionsPayload.discussions) ? actionsPayload.discussions : [],
            summary: actionsPayload.summary ?? {
              actionsCount: 0,
              discussionsCount: 0,
              discussionMessagesCount: 0
            }
          });
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити дії працівників.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, limit, storeId]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Інвентар / Дії працівників</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Дії працівників</h1>
        <p className="mt-3 text-sm text-slate-700">
          Тут видно, що саме працівники робили з партіями, а також усю переписку по обговореннях товарів.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
          >
            <option value="">Усі магазини</option>
            {stores.filter((store) => store.isActive).map((store) => (
              <option key={store.id} value={store.id}>
                {storeLabel(store)}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
          />
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value || 80))}
            className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
          >
            <option value={40}>Останні 40</option>
            <option value={80}>Останні 80</option>
            <option value={120}>Останні 120</option>
            <option value={200}>Останні 200</option>
          </select>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Дії по партіях</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard?.summary.actionsCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Обговорення</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard?.summary.discussionsCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Повідомлення в діалогах</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard?.summary.discussionMessagesCount ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Дії по партіях</h2>
            <p className="mt-1 text-sm text-slate-600">Перевірки, списання, коригування та інші операції працівників.</p>
          </div>
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {dashboard?.actions.length ?? 0}
          </span>
        </div>

        {isLoading ? (
          <p className="mt-4 text-sm text-slate-600">Завантаження дій...</p>
        ) : dashboard && dashboard.actions.length > 0 ? (
          <div className="mt-4 space-y-3">
            {dashboard.actions.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {getActionBadgeLabel(item.source)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.userName || 'Працівника не визначено'} • {item.storeLabel || 'Магазин не визначено'}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {formatDateTime(item.createdAt)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <p>Товар: <span className="font-semibold text-slate-900">{item.productName || '—'}</span></p>
                  <p>Артикул: <span className="font-semibold text-slate-900">{item.article || '—'}</span></p>
                  <p>Партія: <span className="font-semibold text-slate-900">{item.batchCode || (item.batchId ? `#${item.batchId}` : '—')}</span></p>
                  <p>ID партії: <span className="font-semibold text-slate-900">{item.batchId ?? '—'}</span></p>
                </div>

                <p className="mt-3 text-sm text-slate-800">{item.details || 'Без додаткового коментаря.'}</p>
                {item.photoUrl ? (
                  <a
                    href={item.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-sm font-semibold text-brand transition hover:opacity-80"
                  >
                    Відкрити фото
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">За вибраними фільтрами дій працівників не знайдено.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Обговорення товарів</h2>
            <p className="mt-1 text-sm text-slate-600">Тут видно всі звернення працівників і переписку з керівниками.</p>
          </div>
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {dashboard?.discussions.length ?? 0}
          </span>
        </div>

        {isLoading ? (
          <p className="mt-4 text-sm text-slate-600">Завантаження обговорень...</p>
        ) : dashboard && dashboard.discussions.length > 0 ? (
          <div className="mt-4 space-y-4">
            {dashboard.discussions.map((thread) => (
              <article key={thread.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{thread.title || thread.productName || 'Обговорення товару'}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${thread.status === 'closed' ? 'border-slate-300 bg-white text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        {formatDiscussionStatus(thread.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {thread.storeLabel || 'Магазин не визначено'} • {thread.productName || 'Товар без назви'}
                      {thread.batchCode ? ` • партія ${thread.batchCode}` : ''}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {formatDateTime(thread.lastMessageAt || thread.updatedAt)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <p>Працівник: <span className="font-semibold text-slate-900">{thread.requesterName || '—'}</span></p>
                  <p>Керівник: <span className="font-semibold text-slate-900">{thread.managerName || 'Ще не призначено'}</span></p>
                  <p>Артикул: <span className="font-semibold text-slate-900">{thread.article || '—'}</span></p>
                  <p>Закрито: <span className="font-semibold text-slate-900">{thread.closedAt ? formatDateTime(thread.closedAt) : 'Ще відкрито'}</span></p>
                </div>

                {thread.messages.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {thread.messages.map((message) => (
                      <div key={message.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {message.senderName || 'Невідомий користувач'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {message.senderRole} • {message.channel || 'telegram'}
                              {message.recipientName ? ` • для ${message.recipientName}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            {formatDateTime(message.createdAt)}
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{message.messageText || 'Без тексту повідомлення.'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">У цьому обговоренні ще немає повідомлень.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">За вибраними фільтрами обговорень не знайдено.</p>
        )}
      </section>
    </div>
  );
}
