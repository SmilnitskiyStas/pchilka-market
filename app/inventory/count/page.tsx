'use client';

import { useEffect, useMemo, useState } from 'react';

type InventoryCountSessionView = {
  id: number;
  storeId: number;
  storeLabel: string;
  status: 'draft' | 'in_progress' | 'completed';
  scheduledFor: string;
  startedByUserId: number | null;
  startedByUserName: string;
  completedByUserId: number | null;
  completedByUserName: string;
  itemsCount: number;
  countedItemsCount: number;
  differencesCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
};

type InventoryCountItemView = {
  id: number;
  sessionId: number;
  batchId: number;
  productId: number;
  expectedQuantity: number;
  countedQuantity: number | null;
  differenceQuantity: number | null;
  note: string;
  checkedByUserId: number | null;
  checkedByUserName: string;
  checkedAt: string;
  productNameSnapshot: string;
  articleSnapshot: string;
  barcodeSnapshot: string;
  unitsOfMeasurementSnapshot: string;
  expiryDateSnapshot: string;
  batchCodeSnapshot: string;
  createdAt: string;
  updatedAt: string;
};

type CountContextPayload = {
  ok?: boolean;
  user?: {
    id: number;
    name: string;
    surname: string;
    role: string;
    storeId: number | null;
    storeLabel: string;
  };
  activeSession?: InventoryCountSessionView | null;
  activeItems?: InventoryCountItemView[];
  sessionHistory?: InventoryCountSessionView[];
  error?: string;
};

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
}

function formatSessionStatus(status: InventoryCountSessionView['status']) {
  switch (status) {
    case 'completed':
      return 'Завершено';
    case 'in_progress':
      return 'У процесі';
    case 'draft':
    default:
      return 'Чернетка';
  }
}

function getSessionStatusClassName(status: InventoryCountSessionView['status']) {
  switch (status) {
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'in_progress':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'draft':
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function formatDifference(value: number | null) {
  if (value == null) return '—';
  if (value === 0) return '0';
  if (value > 0) return `+${value}`;
  return String(value);
}

export default function InventoryCountPage() {
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('');
  const [storeLabel, setStoreLabel] = useState('');
  const [activeSession, setActiveSession] = useState<InventoryCountSessionView | null>(null);
  const [activeItems, setActiveItems] = useState<InventoryCountItemView[]>([]);
  const [sessionHistory, setSessionHistory] = useState<InventoryCountSessionView[]>([]);
  const [itemDrafts, setItemDrafts] = useState<Record<number, { countedQuantity: string; note: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isCompletingSession, setIsCompletingSession] = useState(false);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadContext(nextToken: string) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/inventory/count/context?token=${encodeURIComponent(nextToken)}`, {
        cache: 'no-store'
      });
      const payload = (await response.json()) as CountContextPayload;
      if (!response.ok || !payload.ok || !payload.user) {
        throw new Error(payload.error || 'Не вдалося завантажити інвентаризацію.');
      }

      setUserName(`${payload.user.surname} ${payload.user.name}`.trim());
      setStoreLabel(payload.user.storeLabel || '');
      setActiveSession(payload.activeSession ?? null);
      setActiveItems(Array.isArray(payload.activeItems) ? payload.activeItems : []);
      setSessionHistory(Array.isArray(payload.sessionHistory) ? payload.sessionHistory : []);
      setItemDrafts(
        Object.fromEntries(
          (payload.activeItems ?? []).map((item) => [
            item.id,
            {
              countedQuantity: item.countedQuantity == null ? '' : String(item.countedQuantity),
              note: item.note || ''
            }
          ])
        )
      );
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити інвентаризацію.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const nextToken = url.searchParams.get('token') ?? '';
    setToken(nextToken);
    void loadContext(nextToken);
  }, []);

  const completionStats = useMemo(() => {
    const total = activeItems.length;
    const counted = activeItems.filter((item) => item.countedQuantity != null).length;
    const differences = activeItems.filter((item) => Number(item.differenceQuantity ?? 0) !== 0).length;
    return {
      total,
      counted,
      differences,
      remaining: Math.max(total - counted, 0)
    };
  }, [activeItems]);

  async function handleCreateSession() {
    setIsCreatingSession(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/inventory/count/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        session?: InventoryCountSessionView;
        items?: InventoryCountItemView[];
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.session || !Array.isArray(payload.items)) {
        throw new Error(payload.error || 'Не вдалося створити сесію інвентаризації.');
      }

      setActiveSession(payload.session);
      setActiveItems(payload.items);
      setItemDrafts(
        Object.fromEntries(
          payload.items.map((item) => [
            item.id,
            {
              countedQuantity: item.countedQuantity == null ? '' : String(item.countedQuantity),
              note: item.note || ''
            }
          ])
        )
      );
      setSuccess('Сесію інвентаризації створено.');
      await loadContext(token);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не вдалося створити сесію інвентаризації.');
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function handleSaveItem(itemId: number) {
    const draft = itemDrafts[itemId];
    if (!draft || !activeSession) return;

    setSavingItemId(itemId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/inventory/count/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          sessionId: activeSession.id,
          itemId,
          countedQuantity: Number(draft.countedQuantity || 0),
          note: draft.note
        })
      });
      const payload = (await response.json()) as { ok?: boolean; item?: InventoryCountItemView; error?: string };
      if (!response.ok || !payload.ok || !payload.item) {
        throw new Error(payload.error || 'Не вдалося зберегти позицію інвентаризації.');
      }

      setActiveItems((prev) => prev.map((item) => (item.id === payload.item?.id ? payload.item : item)));
      setItemDrafts((prev) => ({
        ...prev,
        [itemId]: {
          countedQuantity: payload.item?.countedQuantity == null ? '' : String(payload.item.countedQuantity),
          note: payload.item?.note || ''
        }
      }));
      setSuccess(`Позицію партії #${payload.item.batchId} збережено.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти позицію інвентаризації.');
    } finally {
      setSavingItemId(null);
    }
  }

  async function handleCompleteSession() {
    if (!activeSession) return;

    setIsCompletingSession(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/inventory/count/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sessionId: activeSession.id })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        session?: InventoryCountSessionView;
        items?: InventoryCountItemView[];
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.session || !Array.isArray(payload.items)) {
        throw new Error(payload.error || 'Не вдалося завершити інвентаризацію.');
      }

      setActiveSession(null);
      setActiveItems([]);
      setItemDrafts({});
      setSuccess('Інвентаризацію завершено. Залишки оновлено.');
      await loadContext(token);
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : 'Не вдалося завершити інвентаризацію.');
    } finally {
      setIsCompletingSession(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full rounded-3xl border border-brand/20 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Inventory / Count Session</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Щотижнева інвентаризація товарів</h1>
        <p className="mt-2 text-sm text-slate-600">
          Працівник відкриває сесію по своєму магазину, вносить фактичні залишки по партіях і після завершення система
          оновлює кількість у базі та зберігає історію коригувань.
        </p>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження...</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {!isLoading ? (
          <>
            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Працівник</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{userName || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Магазин</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{storeLabel || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Стан</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeSession ? `Є активна сесія #${activeSession.id}` : 'Активної сесії немає'}
                </p>
              </div>
            </div>

            {!activeSession ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Почати нову інвентаризацію</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Система створить сесію по всіх активних партіях вашого магазину з поточними очікуваними залишками.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCreateSession();
                    }}
                    disabled={isCreatingSession}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isCreatingSession ? 'Створення...' : 'Створити сесію'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Активна сесія #{activeSession.id}</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Дата інвентаризації: {activeSession.scheduledFor} • створив: {activeSession.startedByUserName || '—'}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getSessionStatusClassName(activeSession.status)}`}>
                      {formatSessionStatus(activeSession.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Усього позицій</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{completionStats.total}</p>
                    </div>
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Перевірено</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{completionStats.counted}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Розбіжності</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{completionStats.differences}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Залишилось</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{completionStats.remaining}</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Позиції інвентаризації</p>
                      <p className="mt-1 text-xs text-slate-500">Для кожної партії внесіть фактичну кількість і за потреби додайте примітку.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleCompleteSession();
                      }}
                      disabled={isCompletingSession || completionStats.total === 0}
                      className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isCompletingSession ? 'Завершення...' : 'Завершити інвентаризацію'}
                    </button>
                  </div>

                  <div className="max-h-[68vh] overflow-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Товар</th>
                          <th className="px-4 py-3">Партія</th>
                          <th className="px-4 py-3">Очікувано</th>
                          <th className="px-4 py-3">Фактично</th>
                          <th className="px-4 py-3">Різниця</th>
                          <th className="px-4 py-3">Примітка</th>
                          <th className="px-4 py-3">Дія</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {activeItems.map((item) => {
                          const draft = itemDrafts[item.id] ?? {
                            countedQuantity: item.countedQuantity == null ? '' : String(item.countedQuantity),
                            note: item.note || ''
                          };
                          const currentDifference =
                            draft.countedQuantity === ''
                              ? null
                              : Number(draft.countedQuantity || 0) - Number(item.expectedQuantity || 0);

                          return (
                            <tr key={item.id}>
                              <td className="px-4 py-3 align-top">
                                <p className="font-semibold text-slate-900">{item.productNameSnapshot}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Арт.: {item.articleSnapshot || '—'} • ШК: {item.barcodeSnapshot || '—'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Од. виміру: {item.unitsOfMeasurementSnapshot || '—'}
                                </p>
                              </td>
                              <td className="px-4 py-3 align-top text-slate-700">
                                <p>#{item.batchId}</p>
                                <p className="mt-1 text-xs text-slate-500">Код: {item.batchCodeSnapshot || '—'}</p>
                                <p className="mt-1 text-xs text-slate-500">Термін: {item.expiryDateSnapshot || '—'}</p>
                              </td>
                              <td className="px-4 py-3 align-top font-semibold text-slate-900">{item.expectedQuantity}</td>
                              <td className="px-4 py-3 align-top">
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.countedQuantity}
                                  onChange={(event) =>
                                    setItemDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...draft,
                                        countedQuantity: event.target.value
                                      }
                                    }))
                                  }
                                  className="w-28 rounded-xl border border-slate-300 p-2 text-sm outline-none focus:border-brand"
                                />
                                {item.checkedAt ? (
                                  <p className="mt-2 text-xs text-slate-500">
                                    {item.checkedByUserName || 'Збережено'} • {formatDate(item.checkedAt)}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 align-top">
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                    currentDifference == null
                                      ? 'border-slate-200 bg-slate-50 text-slate-500'
                                      : currentDifference === 0
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {formatDifference(currentDifference)}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <textarea
                                  value={draft.note}
                                  onChange={(event) =>
                                    setItemDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...draft,
                                        note: event.target.value
                                      }
                                    }))
                                  }
                                  rows={3}
                                  className="min-w-[220px] rounded-xl border border-slate-300 p-2 text-sm outline-none focus:border-brand"
                                />
                              </td>
                              <td className="px-4 py-3 align-top">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleSaveItem(item.id);
                                  }}
                                  disabled={savingItemId === item.id || draft.countedQuantity === ''}
                                  className="rounded-full border border-brand px-3 py-1.5 text-xs font-semibold text-brand disabled:opacity-60"
                                >
                                  {savingItemId === item.id ? 'Збереження...' : 'Зберегти'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Історія сесій</h2>
                  <p className="mt-1 text-sm text-slate-600">Останні інвентаризації по вашому магазину.</p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {sessionHistory.length}
                </span>
              </div>

              {sessionHistory.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">Сесій інвентаризації ще не було.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {sessionHistory.map((session) => (
                    <article key={session.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Сесія #{session.id}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Дата: {session.scheduledFor} • створив: {session.startedByUserName || '—'}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSessionStatusClassName(session.status)}`}>
                          {formatSessionStatus(session.status)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Позицій: {session.itemsCount}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Перевірено: {session.countedItemsCount}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Розбіжностей: {session.differencesCount}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Оновлено: {formatDate(session.updatedAt)}</span>
                        {session.completedAt ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                            Завершено: {formatDate(session.completedAt)}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
