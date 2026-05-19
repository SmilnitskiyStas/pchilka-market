'use client';

import { useEffect, useMemo, useState } from 'react';
import { uploadRequestAttachment } from '@/lib/request-attachment-client';
import {
  getSuspiciousInventoryExpiryDate,
  type SuspiciousInventoryExpiryDate
} from '@/lib/inventory-expiry-date-rules';
import { canEditInventoryBatchExpiry, type InventoryUserRole } from '@/lib/inventory-user-roles';

type ExpiringBatchView = {
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
  createdAt: string;
  updatedAt: string;
  daysLeft: number;
};

type ManageContextPayload = {
  ok?: boolean;
  user?: {
    id: number;
    name: string;
    surname: string;
    role: InventoryUserRole;
    storeId: number | null;
    storeLabel: string;
  };
  storeBatches?: ExpiringBatchView[];
  expiringBatches?: ExpiringBatchView[];
  error?: string;
};

type BatchExpiryCorrectionPayload = {
  ok?: boolean;
  batch?: ExpiringBatchView;
  suspiciousExpiryDate?: SuspiciousInventoryExpiryDate;
  correction?: {
    id: number;
    oldExpiryDate: string;
    newExpiryDate: string;
    reason: string;
    comment: string;
    photoUrl: string;
    changedByUserName: string;
    createdAt: string;
  };
  error?: string;
};

const expiryCorrectionReasonOptions = [
  { value: 'wrong_year', label: 'Помилка в році' },
  { value: 'wrong_day_or_month', label: 'Помилка в дні або місяці' },
  { value: 'label_rechecked', label: 'Перевірено по етикетці' },
  { value: 'supplier_data_error', label: 'Помилка в даних постачальника' },
  { value: 'other', label: 'Інша причина' }
] as const;

function RequiredMark() {
  return <span className="ml-1 font-semibold text-red-600">*</span>;
}

export default function InventoryManageExpiryDatePage() {
  const [token, setToken] = useState('');
  const [batchId, setBatchId] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<InventoryUserRole>('staff');
  const [storeLabel, setStoreLabel] = useState('');
  const [batch, setBatch] = useState<ExpiringBatchView | null>(null);
  const [expiryCorrectionNewDate, setExpiryCorrectionNewDate] = useState('');
  const [expiryCorrectionReason, setExpiryCorrectionReason] = useState('wrong_year');
  const [expiryCorrectionComment, setExpiryCorrectionComment] = useState('');
  const [expiryCorrectionPhotoFile, setExpiryCorrectionPhotoFile] = useState<File | null>(null);
  const [expiryCorrectionPhotoUrl, setExpiryCorrectionPhotoUrl] = useState('');
  const [expiryCorrectionWarning, setExpiryCorrectionWarning] = useState<SuspiciousInventoryExpiryDate | null>(null);
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
        const response = await fetch(`/api/inventory/manage/context?token=${encodeURIComponent(nextToken)}`, {
          cache: 'no-store'
        });
        const payload = (await response.json()) as ManageContextPayload;
        if (!response.ok || !payload.ok || !payload.user) {
          throw new Error(payload.error || 'Не вдалося завантажити сторінку зміни дати.');
        }

        if (!canEditInventoryBatchExpiry(payload.user.role)) {
          throw new Error('У вас немає прав для контрольованої зміни дати.');
        }

        const allBatches = [...(payload.storeBatches ?? []), ...(payload.expiringBatches ?? [])];
        const targetBatch = allBatches.find((item) => item.id === nextBatchId) ?? null;
        if (!targetBatch) {
          throw new Error('Партію не знайдено або вона вже недоступна.');
        }

        setCurrentUserRole(payload.user.role);
        setStoreLabel(payload.user.storeLabel);
        setBatch(targetBatch);
        setExpiryCorrectionNewDate(targetBatch.expiryDate);
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити сторінку зміни дати.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (batchId) params.set('batchId', batchId);
    const query = params.toString();
    return `/inventory/manage${query ? `?${query}` : ''}`;
  }, [batchId, token]);

  function handleExpiryCorrectionPhotoChange(file: File | null) {
    setExpiryCorrectionPhotoFile(file);
    if (file) {
      setExpiryCorrectionPhotoUrl('');
      setError('');
    }
  }

  async function handleSave(confirmSuspiciousExpiryDate = false) {
    if (!batch) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!confirmSuspiciousExpiryDate) {
        const localSuspiciousExpiryDate = getSuspiciousInventoryExpiryDate({
          expiryDate: expiryCorrectionNewDate,
          deliveryDate: batch.deliveryDate
        });
        if (localSuspiciousExpiryDate.isSuspicious) {
          setExpiryCorrectionWarning(localSuspiciousExpiryDate);
          return;
        }
      }

      let nextPhotoUrl = expiryCorrectionPhotoUrl.trim();
      if (!nextPhotoUrl) {
        if (!expiryCorrectionPhotoFile) {
          throw new Error('Додайте фото товару як підтвердження зміни.');
        }
        const uploaded = await uploadRequestAttachment(expiryCorrectionPhotoFile, {
          folder: 'inventory/expiry-corrections'
        });
        nextPhotoUrl = uploaded.url;
        setExpiryCorrectionPhotoUrl(uploaded.url);
      }

      const response = await fetch('/api/inventory/manage/expiry-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          batchId: batch.id,
          newExpiryDate: expiryCorrectionNewDate,
          reason: expiryCorrectionReason,
          comment: expiryCorrectionComment,
          photoUrl: nextPhotoUrl,
          confirmSuspiciousExpiryDate
        })
      });
      const payload = (await response.json()) as BatchExpiryCorrectionPayload;
      if (response.status === 428 && payload.suspiciousExpiryDate) {
        setExpiryCorrectionWarning(payload.suspiciousExpiryDate);
        return;
      }
      if (!response.ok || !payload.ok || !payload.batch || !payload.correction) {
        throw new Error(payload.error || 'Не вдалося змінити термін придатності.');
      }

      setBatch(payload.batch);
      setExpiryCorrectionNewDate(payload.batch.expiryDate);
      setExpiryCorrectionWarning(null);
      setSuccess(`Термін придатності змінено з ${payload.correction.oldExpiryDate} на ${payload.correction.newExpiryDate}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося змінити термін придатності.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full rounded-3xl border border-brand/20 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Inventory / Controlled Expiry Date Change
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={backHref}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Назад
            </a>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
            >
              Перезавантажити
            </button>
          </div>
        </div>

        <h1 className="mt-2 text-2xl font-bold text-slate-900">Контрольована зміна дати</h1>
        <p className="mt-2 text-sm text-slate-600">
          Окремий екран для store manager та admin. Зміна терміну придатності зберігається в історію разом із
          причиною, коментарем, фото, користувачем і часом зміни.
        </p>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження...</p> : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            {success}
          </p>
        ) : null}

        {!isLoading && batch ? (
          <>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Магазин</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{storeLabel || '—'}</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{batch.productName}</p>
              <p className="mt-1 text-sm text-slate-600">
                Артикул: {batch.article || '—'} • Штрихкод: {batch.barcode || '—'} • Партія #{batch.id}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              Поля, позначені <span className="font-semibold text-red-600">*</span>, є обов’язковими.
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">Стара дата</span>
                <input
                  value={batch.expiryDate}
                  readOnly
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">
                  Нова дата
                  <RequiredMark />
                </span>
                <input
                  type="date"
                  value={expiryCorrectionNewDate}
                  onChange={(event) => setExpiryCorrectionNewDate(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">
                  Причина зміни
                  <RequiredMark />
                </span>
                <select
                  value={expiryCorrectionReason}
                  onChange={(event) => setExpiryCorrectionReason(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                >
                  {expiryCorrectionReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="block text-sm">
                <span className="font-semibold text-slate-900">
                  Фото товару
                  <RequiredMark />
                </span>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(event) => handleExpiryCorrectionPhotoChange(event.target.files?.[0] ?? null)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
                <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl border border-brand px-4 py-3 text-sm font-semibold text-brand transition hover:bg-brand/5">
                  Зробити фото
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    required
                    onChange={(event) => handleExpiryCorrectionPhotoChange(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
                <span className="mt-1 block text-xs text-slate-500">
                  Верхнє поле відкриває галерею, кнопка нижче дозволяє одразу зробити фото камерою.
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {expiryCorrectionPhotoFile?.name ||
                    (expiryCorrectionPhotoUrl ? 'Фото вже додано' : 'Фото обов’язкове для збереження зміни')}
                </span>
              </div>
            </div>

            <label className="mt-4 block text-sm">
              <span className="font-semibold text-slate-900">
                Коментар
                <RequiredMark />
              </span>
              <textarea
                value={expiryCorrectionComment}
                onChange={(event) => setExpiryCorrectionComment(event.target.value)}
                rows={4}
                placeholder="Опишіть, що саме перевірили і чому змінюєте дату."
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </label>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Код партії:</span> {batch.batchCode || '—'}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-900">Кількість:</span> {batch.quantity}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-900">Дата поставки:</span> {batch.deliveryDate || '—'}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-900">Роль:</span> {currentUserRole}
              </p>
            </div>

            {expiryCorrectionWarning ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">{expiryCorrectionWarning.title || 'Перевірте нову дату'}</p>
                <p className="mt-1">{expiryCorrectionWarning.message}</p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setExpiryCorrectionWarning(null)}
                    disabled={isSaving}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Повернутися
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSave(true);
                    }}
                    disabled={isSaving}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isSaving ? 'Збереження...' : 'Підтвердити зміну'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <a
                href={backHref}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Скасувати
              </a>
              <button
                type="button"
                onClick={() => {
                  void handleSave(false);
                }}
                disabled={isSaving}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSaving ? 'Збереження...' : 'Зберегти зміну'}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
