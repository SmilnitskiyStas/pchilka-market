'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  getSuspiciousInventoryExpiryDate,
  type SuspiciousInventoryExpiryDate
} from '@/lib/inventory-expiry-date-rules';
import { canEditInventoryBatchExpiry, canManageInventoryTaskMode, type InventoryUserRole } from '@/lib/inventory-user-roles';
import { uploadRequestAttachment } from '@/lib/request-attachment-client';
import type { InventoryTaskAssignmentMode } from '@/lib/store-types';

type InventoryUserView = {
  id: number;
  storeId: number | null;
  storeLabel: string;
  name: string;
  surname: string;
  positionTitle: string;
  role: InventoryUserRole;
  isActive: boolean;
  userChatId: string;
};

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
  doNotTrack?: boolean;
  doNotTrackReason?: string;
  createdAt: string;
  updatedAt: string;
  daysLeft: number;
};

type ExpiringProductGroup = {
  key: string;
  productName: string;
  article: string;
  barcode: string;
  totalQuantity: number;
  batchesCount: number;
  minDaysLeft: number;
  nearestExpiryDate: string;
  latestCreatedAt: string;
  hasFocusedBatch: boolean;
  batches: ExpiringBatchView[];
};

type ExpiringSupplyGroup = {
  key: string;
  label: string;
  totalQuantity: number;
  batchesCount: number;
  productsCount: number;
  minDaysLeft: number;
  nearestExpiryDate: string;
  latestCreatedAt: string;
  hasFocusedBatch: boolean;
  products: ExpiringProductGroup[];
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
  store?: {
    id: string;
    storeCode: string;
    city: string;
    addressLine: string;
  };
  users?: InventoryUserView[];
  storeBatches?: ExpiringBatchView[];
  expiringBatches?: ExpiringBatchView[];
  taskAssignmentMode?: InventoryTaskAssignmentMode;
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

const taskAssignmentModeOptions: Array<{
  value: InventoryTaskAssignmentMode;
  label: string;
  description: string;
}> = [
  {
    value: 'personal',
    label: 'Персональні задачі',
    description: 'Кожен працівник бачить і отримує тільки свої задачі.'
  },
  {
    value: 'shared',
    label: 'Спільний список магазину',
    description: 'Усі працівники бачать спільний список і беруть задачі в роботу вручну.'
  },
  {
    value: 'hybrid',
    label: 'Змішаний режим',
    description: 'Критичні задачі персональні, інші доступні у спільному списку магазину.'
  }
];

function formatDaysLeft(value: number) {
  if (value < 0) return `Прострочено на ${Math.abs(value)} дн.`;
  if (value === 0) return 'Спливає сьогодні';
  return `Залишилось ${value} дн.`;
}

function formatBatchCheckStatus(value: string) {
  switch (value) {
    case 'checked':
      return 'Перевірено';
    case 'writeoff':
      return 'На списанні';
    case 'discussion_required':
      return 'Для обговорення';
    case 'do_not_track':
      return 'Не відстежувати';
    case 'new':
    default:
      return 'Нова перевірка';
  }
}

function formatRoleLabel(value: InventoryUserRole) {
  switch (value) {
    case 'admin':
      return 'admin';
    case 'store_manager':
      return 'store_manager';
    case 'manager':
      return 'manager';
    default:
      return 'staff';
  }
}

function buildExpiringProductKey(batch: ExpiringBatchView) {
  const barcode = batch.barcode.trim();
  if (barcode) {
    return `barcode:${barcode}`;
  }

  const article = batch.article.trim();
  if (article) {
    return `article:${article}`;
  }

  return `name:${batch.productName.trim().toLowerCase()}`;
}

function buildSupplyKey(batch: ExpiringBatchView) {
  const batchCode = batch.batchCode.trim();
  if (batchCode) {
    return `batch-code:${batchCode}`;
  }

  return `single-batch:${batch.id}`;
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
}

function daysUntil(value: string) {
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = target.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function compareDateDesc(left: string, right: string) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return right.localeCompare(left);
  }

  return rightTime - leftTime;
}

function normalizeFilterValue(value: string) {
  return value.trim().toLowerCase();
}

function batchMatchesFilter(batch: ExpiringBatchView, filterValue: string) {
  if (!filterValue) return true;

  const haystack = [
    batch.productName,
    batch.article,
    batch.barcode,
    batch.batchCode,
    batch.storeLabel,
    batch.responsibleUserName,
    batch.actionNote,
    batch.checkStatus,
    batch.actionTaken,
    batch.expiryDate,
    batch.deliveryDate,
    batch.id
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(filterValue);
}

function groupBatchesBySupply(
  batches: ExpiringBatchView[],
  focusedBatchId: string,
  sortMode: 'expiry' | 'recent'
): ExpiringSupplyGroup[] {
  const supplyGroups = new Map<string, ExpiringSupplyGroup>();

  for (const batch of batches) {
    const supplyKey = buildSupplyKey(batch);
    const existingSupply = supplyGroups.get(supplyKey);

    if (!existingSupply) {
      supplyGroups.set(supplyKey, {
        key: supplyKey,
        label: batch.batchCode.trim() || `Без коду поставки • партія #${batch.id}`,
        totalQuantity: batch.quantity,
        batchesCount: 1,
        productsCount: 1,
        minDaysLeft: batch.daysLeft,
        nearestExpiryDate: batch.expiryDate,
        latestCreatedAt: batch.createdAt,
        hasFocusedBatch: focusedBatchId === batch.id,
        products: [
          {
            key: buildExpiringProductKey(batch),
            productName: batch.productName,
            article: batch.article,
            barcode: batch.barcode,
            totalQuantity: batch.quantity,
            batchesCount: 1,
            minDaysLeft: batch.daysLeft,
            nearestExpiryDate: batch.expiryDate,
            latestCreatedAt: batch.createdAt,
            hasFocusedBatch: focusedBatchId === batch.id,
            batches: [batch]
          }
        ]
      });
      continue;
    }

    existingSupply.totalQuantity += batch.quantity;
    existingSupply.batchesCount += 1;
    existingSupply.hasFocusedBatch = existingSupply.hasFocusedBatch || focusedBatchId === batch.id;
    if (batch.createdAt > existingSupply.latestCreatedAt) {
      existingSupply.latestCreatedAt = batch.createdAt;
    }
    if (batch.daysLeft < existingSupply.minDaysLeft) {
      existingSupply.minDaysLeft = batch.daysLeft;
      existingSupply.nearestExpiryDate = batch.expiryDate;
    }

    const productKey = buildExpiringProductKey(batch);
    const existingProduct = existingSupply.products.find((item) => item.key === productKey);
    if (!existingProduct) {
      existingSupply.products.push({
        key: productKey,
        productName: batch.productName,
        article: batch.article,
        barcode: batch.barcode,
        totalQuantity: batch.quantity,
        batchesCount: 1,
        minDaysLeft: batch.daysLeft,
        nearestExpiryDate: batch.expiryDate,
        latestCreatedAt: batch.createdAt,
        hasFocusedBatch: focusedBatchId === batch.id,
        batches: [batch]
      });
      continue;
    }

    existingProduct.totalQuantity += batch.quantity;
    existingProduct.batchesCount += 1;
    existingProduct.hasFocusedBatch = existingProduct.hasFocusedBatch || focusedBatchId === batch.id;
    if (batch.daysLeft < existingProduct.minDaysLeft) {
      existingProduct.minDaysLeft = batch.daysLeft;
      existingProduct.nearestExpiryDate = batch.expiryDate;
    }
    if (batch.createdAt > existingProduct.latestCreatedAt) {
      existingProduct.latestCreatedAt = batch.createdAt;
    }
    existingProduct.batches.push(batch);
  }

  return Array.from(supplyGroups.values())
    .map((supply) => ({
      ...supply,
      productsCount: supply.products.length,
      products: supply.products
        .map((product) => ({
          ...product,
          batches: [...product.batches].sort((a, b) => {
            if (sortMode === 'recent') {
              return compareDateDesc(a.createdAt, b.createdAt) || Number(b.id) - Number(a.id);
            }

            return a.daysLeft - b.daysLeft || a.expiryDate.localeCompare(b.expiryDate) || Number(a.id) - Number(b.id);
          })
        }))
        .sort((a, b) => {
          if (sortMode === 'recent') {
            return compareDateDesc(a.latestCreatedAt, b.latestCreatedAt) || a.productName.localeCompare(b.productName, 'uk');
          }

          return a.minDaysLeft - b.minDaysLeft || a.productName.localeCompare(b.productName, 'uk');
        })
    }))
    .sort((a, b) => {
      if (sortMode === 'recent') {
        return compareDateDesc(a.latestCreatedAt, b.latestCreatedAt) || a.label.localeCompare(b.label, 'uk');
      }

      return a.minDaysLeft - b.minDaysLeft || a.label.localeCompare(b.label, 'uk');
    });
}

function getSupplyCardClassName(minDaysLeft: number, isFocused: boolean) {
  if (isFocused) return 'border-brand/30 bg-brand/5';
  if (minDaysLeft < 0) return 'border-red-200 bg-red-50/80';
  if (minDaysLeft <= 7) return 'border-amber-200 bg-amber-50/80';
  return 'border-slate-200 bg-white';
}

export default function InventoryManagePage() {
  const [token, setToken] = useState('');
  const [focusedBatchId, setFocusedBatchId] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<InventoryUserRole>('staff');
  const [isUsersSectionOpen, setIsUsersSectionOpen] = useState(false);
  const [manageFilter, setManageFilter] = useState('');
  const [storeLabel, setStoreLabel] = useState('');
  const [taskAssignmentMode, setTaskAssignmentMode] = useState<InventoryTaskAssignmentMode>('personal');
  const [users, setUsers] = useState<InventoryUserView[]>([]);
  const [storeBatches, setStoreBatches] = useState<ExpiringBatchView[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<ExpiringBatchView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [assigningBatchId, setAssigningBatchId] = useState<string>('');
  const [editingExpiryBatch, setEditingExpiryBatch] = useState<ExpiringBatchView | null>(null);
  const [expiryCorrectionNewDate, setExpiryCorrectionNewDate] = useState('');
  const [expiryCorrectionReason, setExpiryCorrectionReason] = useState('wrong_year');
  const [expiryCorrectionComment, setExpiryCorrectionComment] = useState('');
  const [expiryCorrectionPhotoFile, setExpiryCorrectionPhotoFile] = useState<File | null>(null);
  const [expiryCorrectionPhotoUrl, setExpiryCorrectionPhotoUrl] = useState('');
  const [expiryCorrectionWarning, setExpiryCorrectionWarning] = useState<SuspiciousInventoryExpiryDate | null>(null);
  const [isSavingExpiryCorrection, setIsSavingExpiryCorrection] = useState(false);
  const [isSavingTaskMode, setIsSavingTaskMode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const nextToken = url.searchParams.get('token') ?? '';
    const nextFocusedBatchId = url.searchParams.get('batchId') ?? '';
    setToken(nextToken);
    setFocusedBatchId(nextFocusedBatchId);

    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/inventory/manage/context?token=${encodeURIComponent(nextToken)}`, {
          cache: 'no-store'
        });
        const payload = (await response.json()) as ManageContextPayload;
        if (
          !response.ok ||
          !payload.ok ||
          !payload.user ||
          !Array.isArray(payload.users) ||
          !Array.isArray(payload.storeBatches) ||
          !Array.isArray(payload.expiringBatches)
        ) {
          throw new Error(payload.error || 'Не вдалося завантажити сторінку керування магазином.');
        }

        setCurrentUserRole(payload.user.role);
        setStoreLabel(payload.user.storeLabel);
        setTaskAssignmentMode(payload.taskAssignmentMode ?? 'personal');
        setUsers(payload.users);
        setStoreBatches(payload.storeBatches);
        setExpiringBatches(payload.expiringBatches);
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити сторінку керування магазином.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const activeUsers = useMemo(() => users.filter((item) => item.isActive), [users]);
  const normalizedManageFilter = useMemo(() => normalizeFilterValue(manageFilter), [manageFilter]);
  const filteredStoreBatches = useMemo(
    () => storeBatches.filter((item) => batchMatchesFilter(item, normalizedManageFilter)),
    [storeBatches, normalizedManageFilter]
  );
  const filteredExpiringBatches = useMemo(
    () => expiringBatches.filter((item) => batchMatchesFilter(item, normalizedManageFilter)),
    [expiringBatches, normalizedManageFilter]
  );
  const groupedStoreBatches = useMemo(
    () => groupBatchesBySupply(filteredStoreBatches, focusedBatchId, 'recent'),
    [filteredStoreBatches, focusedBatchId]
  );
  const groupedExpiringBatches = useMemo(
    () => groupBatchesBySupply(filteredExpiringBatches, focusedBatchId, 'recent'),
    [filteredExpiringBatches, focusedBatchId]
  );

  function openExpiryCorrectionModal(batch: ExpiringBatchView) {
    setEditingExpiryBatch(batch);
    setExpiryCorrectionNewDate(batch.expiryDate);
    setExpiryCorrectionReason('wrong_year');
    setExpiryCorrectionComment('');
    setExpiryCorrectionPhotoFile(null);
    setExpiryCorrectionPhotoUrl('');
    setExpiryCorrectionWarning(null);
    setError('');
    setSuccess('');
  }

  function closeExpiryCorrectionModal() {
    setEditingExpiryBatch(null);
    setExpiryCorrectionPhotoFile(null);
    setExpiryCorrectionPhotoUrl('');
    setExpiryCorrectionWarning(null);
  }

  function handleExpiryCorrectionPhotoChange(file: File | null) {
    setExpiryCorrectionPhotoFile(file);
    if (file) {
      setExpiryCorrectionPhotoUrl('');
      setError('');
    }
  }

  function upsertBatch(batch: ExpiringBatchView) {
    const nextBatch = {
      ...batch,
      daysLeft: daysUntil(batch.expiryDate)
    };

    setStoreBatches((prev) =>
      prev.some((item) => item.id === nextBatch.id)
        ? prev.map((item) => (item.id === nextBatch.id ? nextBatch : item))
        : [nextBatch, ...prev]
    );
    setExpiringBatches((prev) => {
      const next = prev.some((item) => item.id === nextBatch.id)
        ? prev.map((item) => (item.id === nextBatch.id ? nextBatch : item))
        : [nextBatch, ...prev];
      return nextBatch.daysLeft <= 30 ? next : next.filter((item) => item.id !== nextBatch.id);
    });
  }

  async function handleSaveUser(user: InventoryUserView) {
    setSavingUserId(user.id);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/inventory/manage/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          userId: user.id,
          role: user.role,
          positionTitle: user.positionTitle,
          isActive: user.isActive
        })
      });
      const payload = (await response.json()) as { ok?: boolean; user?: InventoryUserView; error?: string };
      if (!response.ok || !payload.ok || !payload.user) {
        throw new Error(payload.error || 'Не вдалося оновити працівника.');
      }

      setUsers((prev) => prev.map((item) => (item.id === payload.user?.id ? (payload.user as InventoryUserView) : item)));
      setSuccess(`Оновлено працівника: ${payload.user.surname} ${payload.user.name}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося оновити працівника.');
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleSaveTaskAssignmentMode() {
    setIsSavingTaskMode(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/inventory/manage/task-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          taskAssignmentMode
        })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        taskAssignmentMode?: InventoryTaskAssignmentMode;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не вдалося оновити режим задач.');
      }

      setTaskAssignmentMode(payload.taskAssignmentMode ?? taskAssignmentMode);
      setSuccess('Режим розподілу задач оновлено для цього магазину.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося оновити режим задач.');
    } finally {
      setIsSavingTaskMode(false);
    }
  }

  async function handleReassign(batchId: string, responsibleUserId: string) {
    setAssigningBatchId(batchId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/inventory/manage/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          batchId,
          responsibleUserId: responsibleUserId || null
        })
      });
      const payload = (await response.json()) as { ok?: boolean; batch?: ExpiringBatchView; error?: string };
      if (!response.ok || !payload.ok || !payload.batch) {
        throw new Error(payload.error || 'Не вдалося переназначити відповідального.');
      }

      setExpiringBatches((prev) =>
        prev.map((item) =>
          item.id === payload.batch?.id
            ? {
                ...item,
                responsibleUserId: payload.batch.responsibleUserId,
                responsibleUserName: payload.batch.responsibleUserName
              }
            : item
        )
      );
      setStoreBatches((prev) =>
        prev.map((item) =>
          item.id === payload.batch?.id
            ? {
                ...item,
                responsibleUserId: payload.batch.responsibleUserId,
                responsibleUserName: payload.batch.responsibleUserName
              }
            : item
        )
      );
      setSuccess(`Партію ${payload.batch.productName} переназначено.`);
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Не вдалося переназначити відповідального.');
    } finally {
      setAssigningBatchId('');
    }
  }

  async function handleSaveExpiryCorrection(confirmSuspiciousExpiryDate = false) {
    if (!editingExpiryBatch) return;

    setIsSavingExpiryCorrection(true);
    setError('');
    setSuccess('');

    try {
      if (!confirmSuspiciousExpiryDate) {
        const localSuspiciousExpiryDate = getSuspiciousInventoryExpiryDate({
          expiryDate: expiryCorrectionNewDate,
          deliveryDate: editingExpiryBatch.deliveryDate
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
          batchId: editingExpiryBatch.id,
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

      upsertBatch(payload.batch);
      setSuccess(
        `Термін придатності для "${payload.batch.productName}" змінено з ${payload.correction.oldExpiryDate} на ${payload.correction.newExpiryDate}.`
      );
      closeExpiryCorrectionModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося змінити термін придатності.');
    } finally {
      setIsSavingExpiryCorrection(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Inventory / Manage</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              Керування магазином
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Легший інтерфейс для керування людьми, поставками та товарами з наближеним терміном придатності. Весь
              функціонал збережено, але подача стала простішою й чистішою.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`/inventory/tasks?token=${encodeURIComponent(token)}`}
              className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              До задач
            </a>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Оновити
            </button>
          </div>
        </div>

        {isLoading ? <p className="mt-5 text-sm text-slate-600">Завантаження даних магазину...</p> : null}
        {error ? <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {success ? (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {success}
          </p>
        ) : null}

        {!isLoading && !error ? (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Магазин</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{storeLabel || '—'}</p>
              </article>
              <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Роль</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{formatRoleLabel(currentUserRole)}</p>
              </article>
              <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Працівники</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {activeUsers.length} активних / {users.length} всього
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Термінові партії</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{expiringBatches.length} до 30 днів</p>
              </article>
            </section>

            <section className="mt-4 rounded-[1.75rem] border border-slate-200 bg-white p-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                <label className="block text-sm">
                  <span className="font-semibold text-slate-900">Пошук по товарах і партіях</span>
                  <input
                    value={manageFilter}
                    onChange={(event) => setManageFilter(event.target.value)}
                    placeholder="Назва, артикул, штрихкод, код поставки, партія, відповідальний"
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand"
                  />
                </label>

                {canManageInventoryTaskMode(currentUserRole) ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveTaskAssignmentMode();
                    }}
                    disabled={isSavingTaskMode}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isSavingTaskMode ? 'Збереження...' : 'Зберегти режим задач'}
                  </button>
                ) : null}
              </div>

              <p className="mt-3 text-xs leading-6 text-slate-500">
                Фільтр одночасно звужує список поточних поставок і блок товарів, у яких закінчується або вже минув
                термін придатності.
              </p>

              {canManageInventoryTaskMode(currentUserRole) ? (
                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  {taskAssignmentModeOptions.map((option) => {
                    const isSelected = taskAssignmentMode === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-[1.4rem] border p-4 transition ${
                          isSelected ? 'border-brand/30 bg-brand/5' : 'border-slate-200 bg-slate-50/70 hover:border-brand/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="task-assignment-mode"
                            value={option.value}
                            checked={isSelected}
                            onChange={() => setTaskAssignmentMode(option.value)}
                            className="mt-1 h-4 w-4"
                          />
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{option.label}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{option.description}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Команда</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">Працівники магазину</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUsersSectionOpen((prev) => !prev)}
                    className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {isUsersSectionOpen ? 'Згорнути' : 'Розгорнути'}
                  </button>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Тут можна оновлювати посаду, роль та активність працівника без переходу в окремі екрани.
                </p>

                {isUsersSectionOpen ? (
                  <div className="mt-5 space-y-3">
                    {users.map((user) => (
                      <article key={user.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {user.surname} {user.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">chat_id: {user.userChatId || 'не вказано'}</p>
                          </div>
                          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {formatRoleLabel(user.role)}
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          <input
                            value={user.positionTitle}
                            onChange={(event) =>
                              setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, positionTitle: event.target.value } : item)))
                            }
                            placeholder="Посада"
                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand"
                          />

                          <div className="grid gap-3 sm:grid-cols-2">
                            <select
                              value={user.role}
                              onChange={(event) =>
                                setUsers((prev) =>
                                  prev.map((item) =>
                                    item.id === user.id ? { ...item, role: event.target.value as InventoryUserView['role'] } : item
                                  )
                                )
                              }
                              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand"
                            >
                              <option value="staff">staff</option>
                              <option value="manager">manager</option>
                              <option value="store_manager">store_manager</option>
                              {currentUserRole === 'admin' ? <option value="admin">admin</option> : null}
                            </select>

                            <label className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800">
                              <input
                                type="checkbox"
                                checked={user.isActive}
                                onChange={(event) =>
                                  setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, isActive: event.target.checked } : item)))
                                }
                                className="h-4 w-4"
                              />
                              Активний працівник
                            </label>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              void handleSaveUser(user);
                            }}
                            disabled={savingUserId === user.id}
                            className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                          >
                            {savingUserId === user.id ? 'Збереження...' : 'Оновити працівника'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">
                    Список працівників приховано. Відкрийте блок, якщо потрібно змінити ролі, посади або статуси.
                  </p>
                )}
              </section>

              <div className="space-y-6">
                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Поточні поставки</p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-950">Усі активні партії магазину</h2>
                    </div>
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {groupedStoreBatches.length} поставок
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Поставки згруповані за кодом. У кожній групі видно товари, партії, кількість, термін придатності та
                    відповідального працівника.
                  </p>

                  {storeBatches.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-600">У поточному магазині ще немає внесених партій.</p>
                  ) : groupedStoreBatches.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-600">За поточним фільтром активних поставок не знайдено.</p>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {groupedStoreBatches.map((supply) => (
                        <article key={supply.key} className={`rounded-[1.5rem] border p-4 ${getSupplyCardClassName(supply.minDaysLeft, supply.hasFocusedBatch)}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-slate-950">{supply.label}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {supply.productsCount} товарів • {supply.batchesCount} партій • {supply.totalQuantity} од.
                              </p>
                            </div>
                            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              Оновлено: {formatDate(supply.latestCreatedAt)}
                            </span>
                          </div>

                          <div className="mt-4 space-y-3">
                            {supply.products.map((product) => (
                              <div key={product.key} className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">{product.productName}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Артикул: {product.article || '—'} • ШК: {product.barcode || '—'}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                    {product.totalQuantity} од.
                                  </span>
                                </div>

                                <div className="mt-3 space-y-3">
                                  {product.batches.map((batch) => (
                                    <div
                                      key={batch.id}
                                      className={`rounded-[1rem] border p-4 ${
                                        focusedBatchId === batch.id ? 'border-brand/30 bg-brand/5' : 'border-slate-200 bg-slate-50/70'
                                      }`}
                                    >
                                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                                        <div className="space-y-2">
                                          <p className="text-sm font-semibold text-slate-950">Партія #{batch.id}</p>
                                          <div className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                                            <p>Кількість: {batch.quantity} од.</p>
                                            <p>Термін: {batch.expiryDate}</p>
                                            <p>Дата поставки: {batch.deliveryDate || '—'}</p>
                                            <p>Створено: {formatDate(batch.createdAt)}</p>
                                          </div>
                                          <div className="grid gap-1 text-sm text-slate-700">
                                            <p>Статус перевірки: {formatBatchCheckStatus(batch.checkStatus || 'new')}</p>
                                            <p>Остання дія: {formatBatchCheckStatus(batch.actionTaken || batch.checkStatus || 'new')}</p>
                                            <p>Відповідальний: {batch.responsibleUserName || 'не призначено'}</p>
                                            {batch.actionNote ? <p>Примітка: {batch.actionNote}</p> : null}
                                          </div>
                                        </div>

                                        <div className="space-y-3">
                                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                                            {formatDaysLeft(batch.daysLeft)}
                                          </div>
                                          <select
                                            value={batch.responsibleUserId}
                                            onChange={(event) => {
                                              void handleReassign(batch.id, event.target.value);
                                            }}
                                            disabled={assigningBatchId === batch.id}
                                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand disabled:opacity-60"
                                          >
                                            <option value="">Без відповідального</option>
                                            {activeUsers.map((user) => (
                                              <option key={user.id} value={user.id}>
                                                {[`${user.surname} ${user.name}`, user.positionTitle].filter(Boolean).join(' | ')}
                                              </option>
                                            ))}
                                          </select>
                                          {canEditInventoryBatchExpiry(currentUserRole) ? (
                                            <button
                                              type="button"
                                              onClick={() => openExpiryCorrectionModal(batch)}
                                              className="w-full rounded-2xl border border-brand px-4 py-3 text-sm font-semibold text-brand transition hover:bg-brand/5"
                                            >
                                              Змінити термін придатності
                                            </button>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Контроль термінів</p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-950">Партії до 30 днів або прострочені</h2>
                    </div>
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {groupedExpiringBatches.length} поставок
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Тут зібрані товари, які вже прострочені або входять у вікно контролю. Для кожної партії доступне
                    переназначення відповідального та ручне коригування терміну придатності.
                  </p>

                  {expiringBatches.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-600">У магазині зараз немає партій зі строком до 30 днів.</p>
                  ) : groupedExpiringBatches.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-600">За поточним фільтром термінових товарів не знайдено.</p>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {groupedExpiringBatches.map((supply) => (
                        <article key={supply.key} className={`rounded-[1.5rem] border p-4 ${getSupplyCardClassName(supply.minDaysLeft, supply.hasFocusedBatch)}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-slate-950">{supply.label}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {supply.productsCount} товарів • {supply.batchesCount} партій
                              </p>
                            </div>
                            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {formatDaysLeft(supply.minDaysLeft)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
                            <p>Найближчий термін: {supply.nearestExpiryDate}</p>
                            <p>Загальна кількість: {supply.totalQuantity}</p>
                            <p>Карток у поставці: {supply.batchesCount}</p>
                          </div>

                          <div className="mt-4 space-y-3">
                            {supply.products.map((product) => (
                              <div key={product.key} className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">{product.productName}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Артикул: {product.article || '—'} • ШК: {product.barcode || '—'} • партій: {product.batchesCount}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                    {formatDaysLeft(product.minDaysLeft)}
                                  </span>
                                </div>

                                <div className="mt-3 space-y-3">
                                  {product.batches.map((batch) => (
                                    <div
                                      key={batch.id}
                                      className={`rounded-[1rem] border p-4 ${
                                        focusedBatchId === batch.id ? 'border-brand/30 bg-brand/5' : 'border-slate-200 bg-slate-50/70'
                                      }`}
                                    >
                                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                                        <div className="space-y-2">
                                          <p className="text-sm font-semibold text-slate-950">Партія #{batch.id}</p>
                                          <p className="text-xs text-slate-500">
                                            Код партії: {batch.batchCode || '—'} • Термін: {batch.expiryDate} • Кількість: {batch.quantity}
                                          </p>
                                          <div className="grid gap-1 text-sm text-slate-700">
                                            <p>Відповідальний: {batch.responsibleUserName || 'не призначено'}</p>
                                            <p>Статус перевірки: {formatBatchCheckStatus(batch.checkStatus || 'new')}</p>
                                            <p>Остання дія: {formatBatchCheckStatus(batch.actionTaken || batch.checkStatus || 'new')}</p>
                                            {batch.actionNote ? <p>Примітка: {batch.actionNote}</p> : null}
                                          </div>
                                        </div>

                                        <div className="space-y-3">
                                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                                            {formatDaysLeft(batch.daysLeft)}
                                          </div>
                                          <select
                                            value={batch.responsibleUserId}
                                            onChange={(event) => {
                                              void handleReassign(batch.id, event.target.value);
                                            }}
                                            disabled={assigningBatchId === batch.id}
                                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand disabled:opacity-60"
                                          >
                                            <option value="">Без відповідального</option>
                                            {activeUsers.map((user) => (
                                              <option key={user.id} value={user.id}>
                                                {[`${user.surname} ${user.name}`, user.positionTitle].filter(Boolean).join(' | ')}
                                              </option>
                                            ))}
                                          </select>
                                          {canEditInventoryBatchExpiry(currentUserRole) ? (
                                            <button
                                              type="button"
                                              onClick={() => openExpiryCorrectionModal(batch)}
                                              className="w-full rounded-2xl border border-brand px-4 py-3 text-sm font-semibold text-brand transition hover:bg-brand/5"
                                            >
                                              Змінити термін придатності
                                            </button>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        ) : null}
      </section>

      {editingExpiryBatch ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Коригування дати</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">{editingExpiryBatch.productName}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Зміна терміну придатності зберігається в історію разом із причиною, коментарем, фото та користувачем, який
              виконав дію.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">Стара дата</span>
                <input
                  value={editingExpiryBatch.expiryDate}
                  readOnly
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">Нова дата</span>
                <input
                  type="date"
                  value={expiryCorrectionNewDate}
                  onChange={(event) => setExpiryCorrectionNewDate(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">Причина зміни</span>
                <select
                  value={expiryCorrectionReason}
                  onChange={(event) => setExpiryCorrectionReason(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand"
                >
                  {expiryCorrectionReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-sm">
                <span className="font-semibold text-slate-900">Фото товару</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleExpiryCorrectionPhotoChange(event.target.files?.[0] ?? null)}
                  className="mt-2 block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                />
                <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-2xl border border-brand px-4 py-3 text-sm font-semibold text-brand transition hover:bg-brand/5">
                  Зробити фото
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => handleExpiryCorrectionPhotoChange(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
                <span className="mt-2 block text-xs text-slate-500">
                  {expiryCorrectionPhotoFile?.name || (expiryCorrectionPhotoUrl ? 'Фото вже додано' : 'Фото обов’язкове')}
                </span>
              </div>
            </div>

            <label className="mt-4 block text-sm">
              <span className="font-semibold text-slate-900">Коментар</span>
              <textarea
                value={expiryCorrectionComment}
                onChange={(event) => setExpiryCorrectionComment(event.target.value)}
                rows={4}
                placeholder="Опишіть, що саме перевірили і чому змінюєте дату."
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand"
              />
            </label>

            <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Партія:</span> #{editingExpiryBatch.id}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-900">Код партії:</span> {editingExpiryBatch.batchCode || '—'}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-900">Кількість:</span> {editingExpiryBatch.quantity}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-900">Дата поставки:</span> {editingExpiryBatch.deliveryDate || '—'}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeExpiryCorrectionModal}
                disabled={isSavingExpiryCorrection}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveExpiryCorrection(false);
                }}
                disabled={isSavingExpiryCorrection}
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSavingExpiryCorrection ? 'Збереження...' : 'Зберегти зміну'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingExpiryBatch && expiryCorrectionWarning ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4 py-6">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">Підтвердження дати</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">
              {expiryCorrectionWarning.title || 'Перевірте нову дату'}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{expiryCorrectionWarning.message}</p>
            <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Стара дата:</span> {editingExpiryBatch.expiryDate}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-900">Нова дата:</span> {expiryCorrectionNewDate || '—'}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setExpiryCorrectionWarning(null)}
                disabled={isSavingExpiryCorrection}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Повернутися
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveExpiryCorrection(true);
                }}
                disabled={isSavingExpiryCorrection}
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSavingExpiryCorrection ? 'Збереження...' : 'Підтвердити зміну'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
