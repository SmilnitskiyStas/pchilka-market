'use client';

import { useEffect, useMemo, useState } from 'react';

import { type InventoryUserRole } from '@/lib/inventory-user-roles';

type TaskView = {
  id: number;
  batchId: number;
  productId: number;
  storeId: number;
  responsibleUserId: number | null;
  assignedUserId: number | null;
  sourceType: string;
  taskType: string;
  status: string;
  outcome: string;
  riskLevel: string;
  dueDate: string;
  daysLeftSnapshot: number;
  title: string;
  note: string;
  resolutionNote: string;
  createdByUserId: number | null;
  startedAt: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  lastNotifiedAt: string;
  completedAt: string;
  completedByUserId: number | null;
  createdAt: string;
  updatedAt: string;
  productName: string;
  article: string;
  barcode: string;
  batchCode: string;
  storeLabel: string;
  responsibleUserName: string;
};

type Payload = {
  ok?: boolean;
  user?: {
    id: number;
    name: string;
    surname: string;
    role: InventoryUserRole;
    storeId: number;
  };
  activeTasks?: TaskView[];
  archivedTasks?: TaskView[];
  summary?: {
    active: number;
    archived: number;
    critical: number;
    high: number;
  };
  error?: string;
};

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
}

function formatStatus(value: string) {
  switch (value) {
    case 'open':
      return 'Відкрита';
    case 'in_progress':
      return 'У роботі';
    case 'completed':
      return 'Завершена';
    case 'cancelled':
      return 'Скасована';
    default:
      return value || '—';
  }
}

function formatOutcome(value: string) {
  switch (value) {
    case 'checked_ok':
      return 'Перевірено без проблем';
    case 'fefo_violation':
      return 'Порушення FEFO';
    case 'quantity_mismatch':
      return 'Розбіжність по кількості';
    case 'writeoff_required':
      return 'Потрібне списання';
    case 'manager_review':
      return 'Потрібне погодження керівника';
    default:
      return value || '—';
  }
}

function getRiskBadgeClassName(riskLevel: string) {
  switch (riskLevel) {
    case 'critical':
      return 'border-red-300 bg-red-50 text-red-700';
    case 'high':
      return 'border-amber-300 bg-amber-50 text-amber-700';
    case 'medium':
      return 'border-sky-300 bg-sky-50 text-sky-700';
    default:
      return 'border-slate-300 bg-slate-50 text-slate-700';
  }
}

export default function InventoryTasksPage() {
  const [token, setToken] = useState('');
  const [notificationId, setNotificationId] = useState('');
  const [activeTasks, setActiveTasks] = useState<TaskView[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<TaskView[]>([]);
  const [summary, setSummary] = useState({ active: 0, archived: 0, critical: 0, high: 0 });
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const nextToken = url.searchParams.get('token') ?? '';
    const nextNotificationId = url.searchParams.get('notificationId') ?? '';
    setToken(nextToken);
    setNotificationId(nextNotificationId);

    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/inventory/tasks/context?token=${encodeURIComponent(nextToken)}&notificationId=${encodeURIComponent(nextNotificationId)}`,
          { cache: 'no-store' }
        );
        const payload = (await response.json()) as Payload;
        if (!response.ok || !payload.ok || !payload.user) {
          throw new Error(payload.error || 'Не вдалося завантажити список задач.');
        }

        setUserName([payload.user.surname, payload.user.name].filter(Boolean).join(' '));
        setActiveTasks(Array.isArray(payload.activeTasks) ? payload.activeTasks : []);
        setArchivedTasks(Array.isArray(payload.archivedTasks) ? payload.archivedTasks : []);
        setSummary(payload.summary ?? { active: 0, archived: 0, critical: 0, high: 0 });
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити список задач.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const overdueCount = useMemo(
    () => activeTasks.filter((task) => task.daysLeftSnapshot < 0).length,
    [activeTasks]
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full rounded-3xl border border-brand/20 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Inventory / Tasks</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Мої задачі по інвентарю</h1>
        <p className="mt-2 text-sm text-slate-600">
          Telegram використовується тільки як канал сповіщення. Усі перевірки і дії виконуються тут, у Web App.
        </p>

        {userName ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Працівник: <span className="font-semibold text-slate-900">{userName}</span>
          </p>
        ) : null}

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження задач...</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Активні</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{summary.active}</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Критичні</p>
                <p className="mt-2 text-2xl font-bold text-red-700">{summary.critical}</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Високий ризик</p>
                <p className="mt-2 text-2xl font-bold text-amber-700">{summary.high}</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Прострочені</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{overdueCount}</p>
              </article>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Активні задачі</h2>
                    <p className="mt-1 text-sm text-slate-600">Тут відображаються задачі, які потрібно виконати зараз.</p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {summary.active}
                  </span>
                </div>

                {activeTasks.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Активних задач зараз немає.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {activeTasks.map((task) => (
                      <article key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">{task.productName}</h3>
                            <p className="mt-1 text-xs text-slate-500">{task.storeLabel}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskBadgeClassName(task.riskLevel)}`}>
                              {task.riskLevel}
                            </span>
                            <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {formatStatus(task.status)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                          <p>Тип: <span className="font-semibold text-slate-900">{task.taskType}</span></p>
                          <p>Термін: <span className="font-semibold text-slate-900">{task.dueDate}</span></p>
                          <p>Артикул: <span className="font-semibold text-slate-900">{task.article || '—'}</span></p>
                          <p>Штрихкод: <span className="font-semibold text-slate-900">{task.barcode || '—'}</span></p>
                          <p>Партія: <span className="font-semibold text-slate-900">#{task.batchId}</span></p>
                          <p>Залишилось днів: <span className="font-semibold text-slate-900">{task.daysLeftSnapshot}</span></p>
                        </div>

                        {task.note ? <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700">{task.note}</p> : null}

                        <div className="mt-4 flex flex-wrap gap-3">
                          <a
                            href={`/inventory/batch-check?token=${encodeURIComponent(token)}&batchId=${encodeURIComponent(String(task.batchId))}&taskId=${encodeURIComponent(String(task.id))}`}
                            className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
                          >
                            Відкрити перевірку
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-slate-900">Архів задач</h2>
                <p className="mt-1 text-sm text-slate-600">Останні завершені або скасовані задачі для контролю історії.</p>

                {archivedTasks.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Архівних задач поки немає.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {archivedTasks.map((task) => (
                      <article key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">{task.productName}</h3>
                            <p className="mt-1 text-xs text-slate-500">{task.storeLabel}</p>
                          </div>
                          <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {formatStatus(task.status)}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-slate-700">
                          <p>Результат: <span className="font-semibold text-slate-900">{formatOutcome(task.outcome)}</span></p>
                          <p>Завершено: <span className="font-semibold text-slate-900">{formatDate(task.completedAt)}</span></p>
                          {task.resolutionNote ? <p>Коментар: <span className="text-slate-900">{task.resolutionNote}</span></p> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}

        {notificationId ? (
          <p className="mt-5 text-xs text-slate-500">Повідомлення з Telegram вже зафіксовано як відкрите.</p>
        ) : null}
      </section>
    </main>
  );
}
