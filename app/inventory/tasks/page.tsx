'use client';

import { useEffect, useMemo, useState } from 'react';

import { canManageInventoryUsers, type InventoryUserRole } from '@/lib/inventory-user-roles';
import type { InventoryTaskAssignmentMode } from '@/lib/store-types';

type TaskView = {
  id: number;
  batchId: number;
  productId: number;
  storeId: number;
  responsibleUserId: number | null;
  assignedUserId: number | null;
  assignedUserName: string;
  taskAssignmentMode: InventoryTaskAssignmentMode;
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
    taskAssignmentMode: InventoryTaskAssignmentMode;
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

type QuickTaskFilter = 'all' | 'critical' | 'overdue' | 'high';

function repairMojibake(value: string) {
  const text = String(value ?? '');
  if (!text || (!text.includes('Р') && !text.includes('С') && !text.includes('вЂ'))) {
    return text;
  }

  try {
    const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return repaired.includes('\uFFFD') ? text : repaired;
  } catch {
    return text;
  }
}

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

function formatTaskType(value: string) {
  switch (value) {
    case 'expiry_check':
      return 'Перевірка строку придатності';
    case 'inventory_count':
      return 'Інвентаризація';
    case 'manual_assignment':
      return 'Ручне завдання';
    default:
      return value || '—';
  }
}

function formatRiskLevel(value: string) {
  switch (value) {
    case 'critical':
      return 'Критична';
    case 'high':
      return 'Високий ризик';
    case 'medium':
      return 'Середній ризик';
    case 'low':
      return 'Низький ризик';
    default:
      return value || '—';
  }
}

function formatDaysLeft(value: number) {
  if (value < 0) return `Протерміновано на ${Math.abs(value)} дн.`;
  if (value === 0) return 'Закінчується сьогодні';
  return `Залишилось днів: ${value}`;
}

function formatTaskAssignmentMode(value: InventoryTaskAssignmentMode) {
  switch (value) {
    case 'shared':
      return 'Спільний список';
    case 'hybrid':
      return 'Змішаний режим';
    default:
      return 'Персональні задачі';
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
  const [currentUserRole, setCurrentUserRole] = useState<InventoryUserRole>('staff');
  const [currentUserId, setCurrentUserId] = useState<number>(0);
  const [storeTaskAssignmentMode, setStoreTaskAssignmentMode] = useState<InventoryTaskAssignmentMode>('personal');
  const [taskFilter, setTaskFilter] = useState('');
  const [quickTaskFilter, setQuickTaskFilter] = useState<QuickTaskFilter>('all');
  const [activeTasks, setActiveTasks] = useState<TaskView[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<TaskView[]>([]);
  const [summary, setSummary] = useState({ active: 0, archived: 0, critical: 0, high: 0 });
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [takingTaskId, setTakingTaskId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function loadTasks(nextToken: string, nextNotificationId: string) {
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

      setCurrentUserId(payload.user.id);
      setCurrentUserRole(payload.user.role);
      setStoreTaskAssignmentMode(payload.user.taskAssignmentMode);
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

  useEffect(() => {
    const url = new URL(window.location.href);
    const nextToken = url.searchParams.get('token') ?? '';
    const nextNotificationId = url.searchParams.get('notificationId') ?? '';
    setToken(nextToken);
    setNotificationId(nextNotificationId);
    void loadTasks(nextToken, nextNotificationId);
  }, []);

  const normalizedTaskFilter = taskFilter.trim().toLowerCase();
  const filteredActiveTasks = useMemo(() => {
    return activeTasks.filter((task) => {
      const matchesQuickFilter =
        quickTaskFilter === 'all'
          ? true
          : quickTaskFilter === 'critical'
            ? task.riskLevel === 'critical'
            : quickTaskFilter === 'high'
              ? task.riskLevel === 'high'
              : task.daysLeftSnapshot < 0;

      if (!matchesQuickFilter) {
        return false;
      }

      if (!normalizedTaskFilter) {
        return true;
      }

      const searchable = [
        task.productName,
        task.article,
        task.barcode,
        task.batchCode,
        task.storeLabel,
        task.title,
        task.note,
        task.responsibleUserName,
        task.assignedUserName
      ];

      return searchable.some((value) => String(value ?? '').toLowerCase().includes(normalizedTaskFilter));
    });
  }, [activeTasks, normalizedTaskFilter, quickTaskFilter]);

  const filteredArchivedTasks = useMemo(() => {
    if (!normalizedTaskFilter) return archivedTasks;

    return archivedTasks.filter((task) => {
      const searchable = [
        task.productName,
        task.article,
        task.barcode,
        task.batchCode,
        task.storeLabel,
        task.title,
        task.note,
        task.resolutionNote,
        task.responsibleUserName,
        task.assignedUserName
      ];

      return searchable.some((value) => String(value ?? '').toLowerCase().includes(normalizedTaskFilter));
    });
  }, [archivedTasks, normalizedTaskFilter]);

  const overdueCount = useMemo(
    () => filteredActiveTasks.filter((task) => task.daysLeftSnapshot < 0).length,
    [filteredActiveTasks]
  );

  async function handleTakeTask(taskId: number) {
    setTakingTaskId(taskId);
    setError('');
    try {
      const response = await fetch('/api/inventory/tasks/take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          taskId
        })
      });
      const payload = (await response.json()) as { ok?: boolean; task?: TaskView; error?: string };
      if (!response.ok || !payload.ok || !payload.task) {
        throw new Error(payload.error || 'Не вдалося взяти задачу в роботу.');
      }

      setActiveTasks((prev) => prev.map((task) => (task.id === payload.task?.id ? payload.task : task)));
    } catch (takeError) {
      setError(takeError instanceof Error ? takeError.message : 'Не вдалося взяти задачу в роботу.');
    } finally {
      setTakingTaskId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full rounded-3xl border border-brand/20 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Inventory / Tasks</p>
          {canManageInventoryUsers(currentUserRole) ? (
            <a
              href={`/inventory/manage?token=${encodeURIComponent(token)}`}
              className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
            >
              Admin
            </a>
          ) : null}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Мої задачі по інвентарю</h1>
        <p className="mt-2 text-sm text-slate-600">
          Telegram використовується тільки як канал сповіщення. Усі перевірки та дії виконуються тут, у Web App.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {userName ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Працівник: <span className="font-semibold text-slate-900">{userName}</span>
            </p>
          ) : null}
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Режим задач магазину: <span className="font-semibold text-slate-900">{formatTaskAssignmentMode(storeTaskAssignmentMode)}</span>
          </p>
        </div>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження задач...</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          <>
            <div className="mt-5">
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">Пошук по задачах</span>
                <input
                  value={taskFilter}
                  onChange={(event) => setTaskFilter(event.target.value)}
                  placeholder="Назва, артикул, штрихкод, код партії..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Фільтр шукає по назві товару, артикулу, штрихкоду, коду партії, магазину, відповідальному та примітках.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['all', 'Усі'],
                  ['critical', 'Критичні'],
                  ['overdue', 'Протерміновані'],
                  ['high', 'Високий ризик']
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setQuickTaskFilter(value as QuickTaskFilter)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      quickTaskFilter === value
                        ? value === 'critical'
                          ? 'border-red-600 bg-red-600 text-white'
                          : value === 'overdue'
                            ? 'border-slate-800 bg-slate-800 text-white'
                            : value === 'high'
                              ? 'border-amber-500 bg-amber-500 text-white'
                              : 'border-brand bg-brand text-white'
                        : value === 'critical'
                          ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300'
                          : value === 'overdue'
                            ? 'border-slate-300 bg-slate-100 text-slate-800 hover:border-slate-400'
                            : value === 'high'
                              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-brand hover:text-brand'
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Активні</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{filteredActiveTasks.length}</p>
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
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Протерміновані</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{overdueCount}</p>
              </article>
            </div>

            <div className="mt-6 space-y-8">
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Активні задачі</h2>
                    <p className="mt-1 text-sm text-slate-600">Тут відображаються задачі, які потрібно виконати зараз.</p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {filteredActiveTasks.length}
                  </span>
                </div>

                {filteredActiveTasks.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Активних задач зараз немає.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {filteredActiveTasks.map((task) => {
                      const isManagerView = canManageInventoryUsers(currentUserRole);
                      const isSharedTask = task.taskAssignmentMode === 'shared';
                      const isTakenByCurrentUser = Number(task.assignedUserId ?? 0) === Number(currentUserId);
                      const isTakenByAnotherUser =
                        Number(task.assignedUserId ?? 0) > 0 && Number(task.assignedUserId ?? 0) !== Number(currentUserId);
                      const canTakeTask = !isManagerView && isSharedTask && !task.assignedUserId;
                      const canOpenTask = isManagerView || !isSharedTask || isTakenByCurrentUser;

                      return (
                        <article key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">{task.productName}</h3>
                              <p className="mt-1 text-xs text-slate-500">{task.storeLabel}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskBadgeClassName(task.riskLevel)}`}>
                                {formatRiskLevel(task.riskLevel)}
                              </span>
                              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                {formatStatus(task.status)}
                              </span>
                              <span className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand">
                                {formatTaskAssignmentMode(task.taskAssignmentMode)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                            <p>Тип: <span className="font-semibold text-slate-900">{formatTaskType(task.taskType)}</span></p>
                            <p>Термін: <span className="font-semibold text-slate-900">{task.dueDate}</span></p>
                            <p>Артикул: <span className="font-semibold text-slate-900">{task.article || '—'}</span></p>
                            <p>Штрихкод: <span className="font-semibold text-slate-900">{task.barcode || '—'}</span></p>
                            <p>Партія: <span className="font-semibold text-slate-900">#{task.batchId}</span></p>
                            <p><span className="font-semibold text-slate-900">{formatDaysLeft(task.daysLeftSnapshot)}</span></p>
                            <p>Відповідальний: <span className="font-semibold text-slate-900">{task.responsibleUserName || '—'}</span></p>
                            <p>
                              У роботі:
                              <span className="font-semibold text-slate-900"> {task.assignedUserName || 'ще не взято'}</span>
                            </p>
                          </div>

                          {task.note ? (
                            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{repairMojibake(task.note)}</p>
                          ) : null}
                          {isTakenByAnotherUser && !isManagerView ? (
                            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                              Цю задачу вже взяв у роботу: <span className="font-semibold">{task.assignedUserName}</span>
                            </p>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-3">
                            {canTakeTask ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void handleTakeTask(task.id);
                                }}
                                disabled={takingTaskId === task.id}
                                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                              >
                                {takingTaskId === task.id ? 'Беремо в роботу...' : 'Взяти в роботу'}
                              </button>
                            ) : null}

                            {canOpenTask ? (
                              <a
                                href={`/inventory/batch-check?token=${encodeURIComponent(token)}&batchId=${encodeURIComponent(String(task.batchId))}&taskId=${encodeURIComponent(String(task.id))}`}
                                className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
                              >
                                Відкрити перевірку
                              </a>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Архів задач</h2>
                    <p className="mt-1 text-sm text-slate-600">Останні завершені або скасовані задачі для контролю історії.</p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {filteredArchivedTasks.length}
                  </span>
                </div>

                {filteredArchivedTasks.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Архівних задач поки немає.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {filteredArchivedTasks.map((task) => (
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
                          {task.assignedUserName ? (
                            <p>Хто виконав: <span className="font-semibold text-slate-900">{task.assignedUserName}</span></p>
                          ) : null}
                          {task.resolutionNote ? (
                            <p>
                              Коментар: <span className="text-slate-900">{repairMojibake(task.resolutionNote)}</span>
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <a
                            href={`/inventory/batch-check?token=${encodeURIComponent(token)}&batchId=${encodeURIComponent(String(task.batchId))}&taskId=${encodeURIComponent(String(task.id))}`}
                            className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
                          >
                            {'\u0412\u0456\u0434\u043a\u0440\u0438\u0442\u0438 \u0434\u043b\u044f \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u043d\u044f'}
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
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
