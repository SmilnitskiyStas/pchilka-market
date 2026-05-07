'use client';

import { useEffect, useState } from 'react';
import { type InventoryUserRole } from '@/lib/inventory-user-roles';

type BatchView = {
  id: string;
  productId: string;
  productName: string;
  article: string;
  barcode: string;
  batchCode: string;
  storeId: string;
  storeLabel: string;
  quantity: number;
  expiryDate: string;
  deliveryDate: string;
  notifiedDays: number;
  responsibleUserId: string;
  responsibleUserName: string;
  checkStatus: string;
  actionTaken: string;
  actionNote: string;
  discussionRequired?: boolean;
};

type Payload = {
  ok?: boolean;
  user?: { id?: number; role: InventoryUserRole };
  batch?: BatchView;
  error?: string;
};

type BatchAction = 'checked' | 'writeoff' | 'discussion_required';

function daysLeftUntil(value: string) {
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusLabel(value: string) {
  switch (value) {
    case 'checked':
      return 'Перевірено';
    case 'writeoff':
      return 'На списанні';
    case 'discussion_required':
      return 'Для обговорення';
    case 'new':
    default:
      return 'Нова перевірка';
  }
}

function getActionLabel(value: BatchAction) {
  switch (value) {
    case 'checked':
      return 'Перевірив';
    case 'writeoff':
      return 'На списанні';
    case 'discussion_required':
      return 'Для обговорення';
  }
}

export default function InventoryBatchCheckPage() {
  const [token, setToken] = useState('');
  const [batchId, setBatchId] = useState('');
  const [role, setRole] = useState<InventoryUserRole>('staff');
  const [batch, setBatch] = useState<BatchView | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const nextToken = url.searchParams.get('token') ?? '';
    const nextBatchId = url.searchParams.get('batchId') ?? '';
    setToken(nextToken);
    setBatchId(nextBatchId);

    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/inventory/batch-check/context?token=${encodeURIComponent(nextToken)}&batchId=${encodeURIComponent(nextBatchId)}`,
          { cache: 'no-store' }
        );
        const payload = (await response.json()) as Payload;
        if (!response.ok || !payload.ok || !payload.batch || !payload.user) {
          throw new Error(payload.error || 'Не вдалося завантажити партію для перевірки.');
        }

        setRole(payload.user.role);
        setBatch(payload.batch);
        setActionNote(payload.batch.actionNote || '');
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити партію для перевірки.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  async function handleBatchAction(action: BatchAction) {
    if (!token || !batchId) return;

    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/inventory/batch-check/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          batchId,
          action,
          note: actionNote
        })
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.ok || !payload.batch) {
        throw new Error(payload.error || 'Не вдалося зберегти дію по партії.');
      }

      setBatch(payload.batch);
      setActionNote(payload.batch.actionNote || '');
      setSuccess(`Статус оновлено: ${getActionLabel(action)}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти дію по партії.');
    } finally {
      setIsSaving(false);
    }
  }

  const daysLeft = batch ? daysLeftUntil(batch.expiryDate) : 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full rounded-3xl border border-brand/20 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Inventory / Batch Check</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Перевірка конкретного товару</h1>
        <p className="mt-2 text-sm text-slate-600">
          Сторінка відкривається з Telegram-повідомлення. Тут можна не лише переглянути партію, а й зафіксувати дію
          працівника, щоб було видно, що товар вже перевірено.
        </p>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження...</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {!isLoading && !error && batch ? (
          <>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{batch.productName}</h2>
                  <p className="mt-1 text-sm text-slate-600">{batch.storeLabel}</p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  партія #{batch.id}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Артикул / ШК</p>
                  <p className="mt-2 text-sm text-slate-900">Артикул: {batch.article || '—'}</p>
                  <p className="mt-1 text-sm text-slate-900">Штрихкод: {batch.barcode || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Поставка / Термін</p>
                  <p className="mt-2 text-sm text-slate-900">Код партії: {batch.batchCode || '—'}</p>
                  <p className="mt-1 text-sm text-slate-900">Термін придатності: {batch.expiryDate}</p>
                  <p className="mt-1 text-sm text-slate-900">Кількість: {batch.quantity}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {daysLeft < 0
                    ? `Термін придатності вже сплив ${Math.abs(daysLeft)} дн. тому.`
                    : daysLeft === 0
                      ? 'Термін придатності спливає сьогодні.'
                      : `До завершення терміну придатності залишилось ${daysLeft} дн.`}
                </p>
                <p className="mt-2 text-sm text-slate-700">Відповідальний: {batch.responsibleUserName || 'не призначено'}</p>
                <p className="mt-1 text-sm text-slate-700">Статус перевірки: {getStatusLabel(batch.checkStatus || 'new')}</p>
                <p className="mt-1 text-sm text-slate-700">Остання дія: {getStatusLabel(batch.actionTaken || batch.checkStatus || 'new')}</p>
                {batch.actionNote ? <p className="mt-1 text-sm text-slate-700">Примітка: {batch.actionNote}</p> : null}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Зафіксувати дію</h2>
              <p className="mt-1 text-sm text-slate-600">
                Після вибору дії система збереже статус партії та покаже, що цей товар уже був перевірений.
              </p>

              <label className="mt-4 block text-sm font-semibold text-slate-900" htmlFor="batch-action-note">
                Примітка
              </label>
              <textarea
                id="batch-action-note"
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                rows={4}
                placeholder="За потреби коротко вкажіть деталі перевірки..."
                className="mt-1.5 w-full rounded-2xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => void handleBatchAction('checked')}
                  disabled={isSaving}
                  className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  Перевірив
                </button>
                <button
                  type="button"
                  onClick={() => void handleBatchAction('writeoff')}
                  disabled={isSaving}
                  className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                >
                  На списанні
                </button>
                <button
                  type="button"
                  onClick={() => void handleBatchAction('discussion_required')}
                  disabled={isSaving}
                  className="rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-60"
                >
                  Для обговорення
                </button>
              </div>
            </div>

            {role === 'manager' || role === 'store_manager' || role === 'admin' ? (
              <div className="mt-4 flex justify-end">
                <a
                  href={`/inventory/manage?token=${encodeURIComponent(token)}&batchId=${encodeURIComponent(batchId)}`}
                  className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
                >
                  Відкрити керування по цій партії
                </a>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
