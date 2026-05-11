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
  quantityReceived: number;
  quantityCurrent: number;
  batchStatus: string;
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

type BatchCheckView = {
  id: number;
  userName: string;
  action: string;
  countedQuantity: number | null;
  itemCondition: string;
  issueReason: string;
  note: string;
  photoUrl: string;
  createdAt: string;
};

type Payload = {
  ok?: boolean;
  user?: { id?: number; role: InventoryUserRole };
  batch?: BatchView;
  checks?: BatchCheckView[];
  error?: string;
};

type BatchAction = 'checked' | 'writeoff' | 'discussion_required';
type BatchCheckFieldErrors = {
  countedQuantity?: string;
  itemCondition?: string;
  issueReason?: string;
};

const ITEM_CONDITIONS = [
  { value: 'ok', label: 'Нормальний стан' },
  { value: 'damaged', label: 'Пошкоджений' },
  { value: 'partial_display', label: 'Викладено частково' },
  { value: 'missing', label: 'Відсутній на полиці' }
];

const ISSUE_REASONS = [
  { value: 'expired', label: 'Прострочений строк' },
  { value: 'damaged', label: 'Пошкодження' },
  { value: 'quantity_mismatch', label: 'Розбіжність по кількості' },
  { value: 'quality_issue', label: 'Проблема якості' },
  { value: 'pricing_issue', label: 'Проблема з ціною' },
  { value: 'other', label: 'Інше' }
];

function daysLeftUntil(value: string) {
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
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

function getConditionLabel(value: string) {
  return ITEM_CONDITIONS.find((item) => item.value === value)?.label || value || '—';
}

function getIssueReasonLabel(value: string) {
  return ISSUE_REASONS.find((item) => item.value === value)?.label || value || '—';
}

function getActionRequirements(action: BatchAction | null) {
  return {
    requiresCountedQuantity: action != null,
    requiresItemCondition: action != null,
    requiresIssueReason: action === 'writeoff' || action === 'discussion_required'
  };
}

export default function InventoryBatchCheckPage() {
  const [token, setToken] = useState('');
  const [batchId, setBatchId] = useState('');
  const [role, setRole] = useState<InventoryUserRole>('staff');
  const [batch, setBatch] = useState<BatchView | null>(null);
  const [checks, setChecks] = useState<BatchCheckView[]>([]);
  const [countedQuantity, setCountedQuantity] = useState('');
  const [itemCondition, setItemCondition] = useState('ok');
  const [issueReason, setIssueReason] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [selectedAction, setSelectedAction] = useState<BatchAction | null>(null);
  const [fieldErrors, setFieldErrors] = useState<BatchCheckFieldErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
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
        setChecks(Array.isArray(payload.checks) ? payload.checks : []);
        setCountedQuantity(String(payload.batch.quantityCurrent ?? payload.batch.quantity ?? ''));
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити партію для перевірки.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  async function uploadPhotoIfNeeded() {
    if (!photoFile) {
      return photoUrl.trim();
    }

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', photoFile);
      formData.append('folder', 'inventory/batch-checks');

      const response = await fetch('/api/uploads/request-attachment', {
        method: 'POST',
        body: formData
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        attachment?: { url?: string };
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.attachment?.url) {
        throw new Error(payload.error || 'Не вдалося завантажити фото.');
      }

      setPhotoUrl(payload.attachment.url);
      return payload.attachment.url;
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  function validateForm(action: BatchAction): BatchCheckFieldErrors {
    const nextErrors: BatchCheckFieldErrors = {};
    const { requiresCountedQuantity, requiresItemCondition, requiresIssueReason } = getActionRequirements(action);
    const parsedCountedQuantity = countedQuantity.trim() === '' ? null : Number(countedQuantity);

    if (
      requiresCountedQuantity &&
      (parsedCountedQuantity == null || !Number.isFinite(parsedCountedQuantity) || parsedCountedQuantity < 0)
    ) {
      nextErrors.countedQuantity = 'Вкажіть фактичну кількість товару.';
    }

    if (requiresItemCondition && !itemCondition.trim()) {
      nextErrors.itemCondition = 'Вкажіть стан товару.';
    }

    if (requiresIssueReason && !issueReason.trim()) {
      nextErrors.issueReason = 'Для цієї дії потрібно вказати причину проблеми.';
    }

    return nextErrors;
  }

  async function handleBatchAction(action: BatchAction) {
    if (!token || !batchId || !batch) return;

    setSelectedAction(action);
    const nextErrors = validateForm(action);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Заповніть обов’язкові поля, які підсвічені нижче.');
      setSuccess('');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const uploadedPhotoUrl = await uploadPhotoIfNeeded();
      const parsedCountedQuantity = countedQuantity.trim() === '' ? null : Number(countedQuantity);

      const response = await fetch('/api/inventory/batch-check/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          batchId,
          action,
          countedQuantity: parsedCountedQuantity,
          itemCondition,
          issueReason,
          note: actionNote,
          photoUrl: uploadedPhotoUrl
        })
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.ok || !payload.batch) {
        throw new Error(payload.error || 'Не вдалося зберегти перевірку партії.');
      }

      setBatch(payload.batch);
      setSuccess(`Перевірку збережено: ${getActionLabel(action)}.`);
      setFieldErrors({});
      setPhotoFile(null);
      setActionNote('');

      const refreshResponse = await fetch(
        `/api/inventory/batch-check/context?token=${encodeURIComponent(token)}&batchId=${encodeURIComponent(batchId)}`,
        { cache: 'no-store' }
      );
      const refreshPayload = (await refreshResponse.json()) as Payload;
      if (refreshResponse.ok && refreshPayload.ok) {
        setChecks(Array.isArray(refreshPayload.checks) ? refreshPayload.checks : []);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти перевірку партії.');
    } finally {
      setIsSaving(false);
    }
  }

  const daysLeft = batch ? daysLeftUntil(batch.expiryDate) : 0;
  const actionRequirements = getActionRequirements(selectedAction);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full rounded-3xl border border-brand/20 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Inventory / Batch Check</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Перевірка конкретної партії товару</h1>
        <p className="mt-2 text-sm text-slate-600">
          Працівник фіксує фактичну кількість, стан товару, причину проблеми, коментар і фото. Історія перевірок зберігається окремо, а у партії лишається поточний статус.
        </p>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження...</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {!isLoading && !error && batch ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{batch.productName}</h2>
                    <p className="mt-1 text-sm text-slate-600">{batch.storeLabel}</p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    Партія #{batch.id}
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
                    <p className="mt-1 text-sm text-slate-900">Отримано: {batch.quantityReceived}</p>
                    <p className="mt-1 text-sm text-slate-900">Поточний залишок: {batch.quantityCurrent}</p>
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
                  <p className="mt-1 text-sm text-slate-700">Статус партії: {batch.batchStatus || 'active'}</p>
                  {batch.actionNote ? <p className="mt-1 text-sm text-slate-700">Останній snapshot: {batch.actionNote}</p> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-slate-900">Історія перевірок</h2>
                <p className="mt-1 text-sm text-slate-600">Останні зафіксовані перевірки по цій партії.</p>

                {checks.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    Історії перевірок ще немає.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {checks.map((check) => (
                      <article key={check.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{getStatusLabel(check.action)}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {check.userName || 'Працівник'} • {formatDate(check.createdAt)}
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Факт. кількість: {check.countedQuantity ?? '—'}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                          <p>Стан: <span className="font-semibold text-slate-900">{getConditionLabel(check.itemCondition)}</span></p>
                          <p>Причина: <span className="font-semibold text-slate-900">{getIssueReasonLabel(check.issueReason)}</span></p>
                        </div>
                        {check.note ? <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700">{check.note}</p> : null}
                        {check.photoUrl ? (
                          <a href={check.photoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/5">
                            Відкрити фото
                          </a>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Зафіксувати перевірку</h2>
              <p className="mt-1 text-sm text-slate-600">
                Працівник вказує фактичну кількість, стан товару, причину проблеми, коментар і за потреби фото.
              </p>

              {selectedAction ? (
                <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Вибрана дія: {getActionLabel(selectedAction)}</p>
                  <p className="mt-2">
                    Обов’язково заповнити:{' '}
                    {[
                      actionRequirements.requiresCountedQuantity ? 'фактичну кількість' : '',
                      actionRequirements.requiresItemCondition ? 'стан товару' : '',
                      actionRequirements.requiresIssueReason ? 'причину проблеми' : ''
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    .
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Спочатку оберіть дію нижче. Після цього форма підкаже, які поля є обов’язковими.
                </div>
              )}

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900" htmlFor="counted-quantity">
                    Фактична кількість
                    {actionRequirements.requiresCountedQuantity ? <span className="ml-1 text-red-600">*</span> : null}
                  </label>
                  <input
                    id="counted-quantity"
                    type="number"
                    min={0}
                    value={countedQuantity}
                    onChange={(event) => {
                      setCountedQuantity(event.target.value);
                      if (fieldErrors.countedQuantity) {
                        setFieldErrors((prev) => ({ ...prev, countedQuantity: undefined }));
                      }
                    }}
                    className={`mt-1.5 w-full rounded-2xl border p-3 text-sm outline-none transition focus:border-brand ${
                      fieldErrors.countedQuantity ? 'border-red-300 bg-red-50' : 'border-slate-300'
                    }`}
                  />
                  {fieldErrors.countedQuantity ? (
                    <p className="mt-1.5 text-xs font-semibold text-red-700">{fieldErrors.countedQuantity}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900" htmlFor="item-condition">
                    Стан товару
                    {actionRequirements.requiresItemCondition ? <span className="ml-1 text-red-600">*</span> : null}
                  </label>
                  <select
                    id="item-condition"
                    value={itemCondition}
                    onChange={(event) => {
                      setItemCondition(event.target.value);
                      if (fieldErrors.itemCondition) {
                        setFieldErrors((prev) => ({ ...prev, itemCondition: undefined }));
                      }
                    }}
                    className={`mt-1.5 w-full rounded-2xl border p-3 text-sm outline-none transition focus:border-brand ${
                      fieldErrors.itemCondition ? 'border-red-300 bg-red-50' : 'border-slate-300'
                    }`}
                  >
                    {ITEM_CONDITIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.itemCondition ? (
                    <p className="mt-1.5 text-xs font-semibold text-red-700">{fieldErrors.itemCondition}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900" htmlFor="issue-reason">
                    Причина проблеми
                  </label>
                  <select
                    id="issue-reason"
                    value={issueReason}
                    onChange={(event) => {
                      setIssueReason(event.target.value);
                      if (fieldErrors.issueReason) {
                        setFieldErrors((prev) => ({ ...prev, issueReason: undefined }));
                      }
                    }}
                    className={`mt-1.5 w-full rounded-2xl border p-3 text-sm outline-none transition focus:border-brand ${
                      fieldErrors.issueReason ? 'border-red-300 bg-red-50' : 'border-slate-300'
                    }`}
                  >
                    <option value="">Без проблеми / не вказано</option>
                    {ISSUE_REASONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.issueReason ? (
                    <p className="mt-1.5 text-xs font-semibold text-red-700">{fieldErrors.issueReason}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900" htmlFor="batch-action-note">
                    Коментар
                  </label>
                  <textarea
                    id="batch-action-note"
                    value={actionNote}
                    onChange={(event) => setActionNote(event.target.value)}
                    rows={4}
                    placeholder="Опишіть результат перевірки, якщо є деталі."
                    className="mt-1.5 w-full rounded-2xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900" htmlFor="batch-photo">
                    Фото
                  </label>
                  <input
                    id="batch-photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                    className="mt-1.5 block w-full rounded-2xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
                  />
                  {photoFile ? <p className="mt-2 text-xs text-slate-500">Обрано файл: {photoFile.name}</p> : null}
                  {photoUrl ? (
                    <a href={photoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-brand hover:underline">
                      Останнє завантажене фото
                    </a>
                  ) : null}
                </div>

                <div className="grid gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAction('checked');
                      void handleBatchAction('checked');
                    }}
                    disabled={isSaving || isUploadingPhoto}
                    className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {isSaving ? 'Збереження...' : 'Перевірив'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAction('writeoff');
                      void handleBatchAction('writeoff');
                    }}
                    disabled={isSaving || isUploadingPhoto}
                    className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                  >
                    {isSaving ? 'Збереження...' : 'На списанні'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAction('discussion_required');
                      void handleBatchAction('discussion_required');
                    }}
                    disabled={isSaving || isUploadingPhoto}
                    className="rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-60"
                  >
                    {isSaving ? 'Збереження...' : 'Для обговорення'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
      </section>
    </main>
  );
}
