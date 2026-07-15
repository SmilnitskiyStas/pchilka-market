'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  getSuspiciousInventoryExpiryDate,
  type SuspiciousInventoryExpiryDate
} from '@/lib/inventory-expiry-date-rules';
import { normalizeInventoryBarcode } from '@/lib/inventory-product-types';
import {
  getInventoryScannerCameraErrorMessage,
  INVENTORY_SCANNER_TIMEOUT_MS,
  INVENTORY_ZXING_SCAN_DELAY_MS,
  openInventoryScannerCamera
} from '@/lib/inventory-scanner-camera';
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

type DetectedBarcode = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

type ZxingControls = {
  stop: () => void;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorInstance;
  }
}

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
    description: 'Усі працівники бачать один спільний список і вручну беруть задачі в роботу.'
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
      return 'На списання';
    case 'discussion_required':
      return 'На обговорення';
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

function formatRoleTitle(value: InventoryUserRole) {
  switch (value) {
    case 'admin':
      return 'Адміністратор';
    case 'store_manager':
      return 'Керівник магазину';
    case 'manager':
      return 'Менеджер';
    default:
      return 'Працівник';
  }
}

function buildExpiringProductKey(batch: ExpiringBatchView) {
  const barcode = batch.barcode.trim();
  if (barcode) return `barcode:${barcode}`;

  const article = batch.article.trim();
  if (article) return `article:${article}`;

  return `name:${batch.productName.trim().toLowerCase()}`;
}

function buildSupplyKey(batch: ExpiringBatchView) {
  const batchCode = batch.batchCode.trim();
  if (batchCode) return `batch-code:${batchCode}`;

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
    if (batch.createdAt > existingSupply.latestCreatedAt) existingSupply.latestCreatedAt = batch.createdAt;
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
    if (batch.createdAt > existingProduct.latestCreatedAt) existingProduct.latestCreatedAt = batch.createdAt;
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

function getSeverityTone(daysLeft: number) {
  if (daysLeft < 0) {
    return {
      badge: 'Expired',
      badgeClassName: 'bg-rose-100 text-rose-700',
      cardClassName: 'border-rose-200 bg-rose-50/70',
      accentClassName: 'text-rose-700'
    };
  }

  if (daysLeft <= 7) {
    return {
      badge: 'Near expiry',
      badgeClassName: 'bg-amber-100 text-amber-700',
      cardClassName: 'border-amber-200 bg-amber-50/70',
      accentClassName: 'text-amber-700'
    };
  }

  return {
    badge: 'Active',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
    cardClassName: 'border-slate-200 bg-white',
    accentClassName: 'text-slate-700'
  };
}

function getTaskStatusTone(value: string) {
  switch (value) {
    case 'writeoff':
      return 'bg-rose-100 text-rose-700';
    case 'discussion_required':
      return 'bg-violet-100 text-violet-700';
    case 'checked':
      return 'bg-emerald-100 text-emerald-700';
    case 'do_not_track':
      return 'bg-slate-200 text-slate-700';
    case 'new':
    default:
      return 'bg-sky-100 text-sky-700';
  }
}

function StatCard({
  value,
  label,
  tone
}: {
  value: string;
  label: string;
  tone: 'neutral' | 'critical' | 'warning' | 'soft';
}) {
  const className =
    tone === 'critical'
      ? 'border-rose-200 bg-rose-50'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'soft'
          ? 'border-sky-200 bg-sky-50'
          : 'border-slate-200 bg-white';

  return (
    <article className={`rounded-[28px] border p-5 ${className}`}>
      <p className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{label}</p>
    </article>
  );
}

function SectionShell({
  title,
  subtitle,
  count,
  actions,
  children
}: {
  title: string;
  subtitle: string;
  count?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {count ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{count}</span> : null}
          {actions}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function InventoryBatchCard({
  batch,
  token,
  focusedBatchId,
  currentUserRole,
  activeUsers,
  assigningBatchId,
  onReassign
}: {
  batch: ExpiringBatchView;
  token: string;
  focusedBatchId: string;
  currentUserRole: InventoryUserRole;
  activeUsers: InventoryUserView[];
  assigningBatchId: string;
  onReassign: (batchId: string, responsibleUserId: string) => void;
}) {
  const severityTone = getSeverityTone(batch.daysLeft);
  const detailHref = canEditInventoryBatchExpiry(currentUserRole)
    ? `/inventory/manage/expiry-date?token=${encodeURIComponent(token)}&batchId=${encodeURIComponent(batch.id)}`
    : `/inventory/manage?token=${encodeURIComponent(token)}&batchId=${encodeURIComponent(batch.id)}`;

  return (
    <article
      className={`rounded-[28px] border p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] transition sm:p-5 ${
        focusedBatchId === batch.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'
      }`}
    >
      <a href={detailHref} className="block">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${severityTone.badgeClassName}`}>{severityTone.badge}</span>
          <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${getTaskStatusTone(batch.checkStatus || 'new')}`}>
            {formatBatchCheckStatus(batch.checkStatus || 'new')}
          </span>
          {focusedBatchId === batch.id ? (
            <span className="rounded-xl bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Поточна</span>
          ) : null}
        </div>

        <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-950">{batch.productName}</h3>
        <p className="mt-1 text-sm text-slate-500">{batch.barcode || batch.article || `Партія #${batch.id}`}</p>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <p className={severityTone.accentClassName}>Exp: {batch.expiryDate}</p>
          <p className="text-slate-600">Qty: {batch.quantity}</p>
          <p className="text-slate-500">Відповідальний: {batch.responsibleUserName || 'не призначено'}</p>
        </div>
      </a>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center">
        <select
          value={batch.responsibleUserId}
          onChange={(event) => {
            void onReassign(batch.id, event.target.value);
          }}
          disabled={assigningBatchId === batch.id}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 disabled:opacity-60 lg:max-w-sm"
        >
          <option value="">Без відповідального</option>
          {activeUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {[`${user.surname} ${user.name}`, user.positionTitle].filter(Boolean).join(' | ')}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-2">
          <a
            href={detailHref}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Деталі
          </a>
        </div>
      </div>
    </article>
  );
}

export default function InventoryManagePage() {
  const [token, setToken] = useState('');
  const [focusedBatchId, setFocusedBatchId] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<InventoryUserRole>('staff');
  const [isUsersSectionOpen, setIsUsersSectionOpen] = useState(false);
  const [manageFilter, setManageFilter] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isStartingScanner, setIsStartingScanner] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const [storeLabel, setStoreLabel] = useState('');
  const [taskAssignmentMode, setTaskAssignmentMode] = useState<InventoryTaskAssignmentMode>('personal');
  const [users, setUsers] = useState<InventoryUserView[]>([]);
  const [storeBatches, setStoreBatches] = useState<ExpiringBatchView[]>([]);
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scannerTimeoutRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<ZxingControls | null>(null);
  const zxingReaderRef = useRef<{ reset?: () => void } | null>(null);
  const scannerEngineRef = useRef<'barcode-detector' | 'zxing' | null>(null);
  const isStartingScannerRef = useRef(false);
  const isDetectingBarcodeRef = useRef(false);
  const isHandlingBarcodeRef = useRef(false);

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
          !Array.isArray(payload.storeBatches)
        ) {
          throw new Error(payload.error || 'Не вдалося завантажити сторінку керування магазином.');
        }

        setCurrentUserRole(payload.user.role);
        setStoreLabel(payload.user.storeLabel);
        setTaskAssignmentMode(payload.taskAssignmentMode ?? 'personal');
        setUsers(payload.users);
        setStoreBatches(payload.storeBatches);
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити сторінку керування магазином.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      stopScanner();
    };
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        const wasScannerActive = scannerEngineRef.current !== null || streamRef.current !== null || zxingControlsRef.current !== null;
        stopScanner();
        if (wasScannerActive) {
          setScannerMessage('Камеру закрито після згортання застосунку. За потреби відкрийте сканер знову.');
        }
      }
    }

    function handlePageHide() {
      stopScanner();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  useEffect(() => {
    if (!isScannerOpen) return;

    scannerTimeoutRef.current = window.setTimeout(() => {
      stopScanner();
      setScannerMessage(
        `Сканер автоматично закрито після ${INVENTORY_SCANNER_TIMEOUT_MS / 1000} секунд без зчитування. Натисніть «Сканувати», щоб спробувати знову.`
      );
    }, INVENTORY_SCANNER_TIMEOUT_MS);

    return () => {
      if (scannerTimeoutRef.current != null) {
        window.clearTimeout(scannerTimeoutRef.current);
        scannerTimeoutRef.current = null;
      }
    };
  }, [isScannerOpen]);

  const activeUsers = useMemo(() => users.filter((item) => item.isActive), [users]);
  const normalizedManageFilter = useMemo(() => normalizeFilterValue(manageFilter), [manageFilter]);
  const expiringBatches = useMemo(() => storeBatches.filter((item) => item.daysLeft <= 30), [storeBatches]);
  const filteredStoreBatches = useMemo(
    () => storeBatches.filter((item) => batchMatchesFilter(item, normalizedManageFilter)),
    [storeBatches, normalizedManageFilter]
  );
  const filteredExpiringBatches = useMemo(
    () => expiringBatches.filter((item) => batchMatchesFilter(item, normalizedManageFilter)),
    [expiringBatches, normalizedManageFilter]
  );
  const sortedStoreBatches = useMemo(
    () => [...filteredStoreBatches].sort((a, b) => compareDateDesc(a.createdAt, b.createdAt) || Number(b.id) - Number(a.id)),
    [filteredStoreBatches]
  );
  const sortedExpiringBatches = useMemo(
    () => [...filteredExpiringBatches].sort((a, b) => a.daysLeft - b.daysLeft || a.expiryDate.localeCompare(b.expiryDate) || Number(a.id) - Number(b.id)),
    [filteredExpiringBatches]
  );
  const overdueBatchesCount = useMemo(() => expiringBatches.filter((item) => item.daysLeft < 0).length, [expiringBatches]);
  const nearExpiryBatchesCount = useMemo(
    () => expiringBatches.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 7).length,
    [expiringBatches]
  );

  useEffect(() => {
    if (!isScannerOpen || !streamRef.current || !videoRef.current || !detectorRef.current) return;
    if (scannerEngineRef.current !== 'barcode-detector') return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    let cancelled = false;

    async function attachAndScan() {
      try {
        await video.play();
      } catch {
        return;
      }

      if (cancelled) return;

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || !detectorRef.current || isDetectingBarcodeRef.current || isHandlingBarcodeRef.current) return;

        isDetectingBarcodeRef.current = true;
        try {
          const detected = await detectorRef.current.detect(videoRef.current);
          const first = detected.find((item) => item.rawValue?.trim());
          if (first?.rawValue) {
            await handleDetectedBarcode(first.rawValue);
          }
        } catch {
          // Ignore transient detector errors while camera stream stabilizes.
        } finally {
          isDetectingBarcodeRef.current = false;
        }
      }, 600);
    }

    void attachAndScan();

    return () => {
      cancelled = true;
      if (scanTimerRef.current != null) {
        window.clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [isScannerOpen]);

  useEffect(() => {
    if (!isScannerOpen || !videoRef.current || !streamRef.current) return;
    if (scannerEngineRef.current !== 'zxing') return;
    if (zxingControlsRef.current) return;

    let cancelled = false;

    async function attachAndScanWithZxing() {
      try {
        const { BarcodeFormat, BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled || !videoRef.current || !streamRef.current) return;
        const stream = streamRef.current;

        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: INVENTORY_ZXING_SCAN_DELAY_MS,
          delayBetweenScanSuccess: INVENTORY_ZXING_SCAN_DELAY_MS
        });
        reader.possibleFormats = [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39
        ];
        zxingReaderRef.current = reader as { reset?: () => void };
        const controls = await reader.decodeFromStream(stream, videoRef.current, (result) => {
          if (result) {
            void handleDetectedBarcode(result.getText());
          }
        });

        if (cancelled) {
          controls.stop();
          (reader as { reset?: () => void }).reset?.();
          return;
        }

        zxingControlsRef.current = controls as ZxingControls;
      } catch (cameraError) {
        if (!cancelled) {
          stopScanner();
          setError(cameraError instanceof Error ? cameraError.message : 'Не вдалося відкрити камеру для сканування.');
        }
      }
    }

    void attachAndScanWithZxing();

    return () => {
      cancelled = true;
    };
  }, [isScannerOpen]);

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
      prev.some((item) => item.id === nextBatch.id) ? prev.map((item) => (item.id === nextBatch.id ? nextBatch : item)) : [nextBatch, ...prev]
    );

  }

  function stopScanner() {
    if (scannerTimeoutRef.current != null) {
      window.clearTimeout(scannerTimeoutRef.current);
      scannerTimeoutRef.current = null;
    }

    if (scanTimerRef.current != null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    detectorRef.current = null;
    scannerEngineRef.current = null;

    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }
    if (zxingReaderRef.current?.reset) {
      zxingReaderRef.current.reset();
      zxingReaderRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setIsScannerOpen(false);
  }

  async function handleDetectedBarcode(rawValue: string) {
    const barcode = normalizeInventoryBarcode(rawValue);
    if (!barcode || isHandlingBarcodeRef.current) return;

    isHandlingBarcodeRef.current = true;
    stopScanner();

    setManageFilter(barcode);
    setScannerMessage(`Знайдено штрихкод: ${barcode}`);
    setSuccess(`Штрихкод ${barcode} підставлено в пошук.`);
    setError('');
  }

  async function startScanner() {
    if (isStartingScannerRef.current) return;
    isStartingScannerRef.current = true;
    setIsStartingScanner(true);
    isDetectingBarcodeRef.current = false;
    isHandlingBarcodeRef.current = false;
    setScannerMessage('');
    setError('');
    setSuccess('');

    if (!window.isSecureContext) {
      setError('Сканування камерою працює лише через HTTPS або на localhost.');
      isStartingScannerRef.current = false;
      setIsStartingScanner(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Браузер не підтримує доступ до камери.');
      isStartingScannerRef.current = false;
      setIsStartingScanner(false);
      return;
    }

    try {
      stopScanner();
      setScannerMessage('Відкриваємо камеру...');
      const stream = await openInventoryScannerCamera();

      if (document.visibilityState === 'hidden') {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        setScannerMessage('Камеру не відкрито, тому що застосунок було згорнуто. Поверніться та запустіть сканер знову.');
        return;
      }

      streamRef.current = stream;
      if (!window.BarcodeDetector) {
        scannerEngineRef.current = 'zxing';
        setIsScannerOpen(true);
        setScannerMessage('Камеру відкрито. Наведіть її на штрихкод товару.');
        return;
      }

      detectorRef.current = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
      });
      scannerEngineRef.current = 'barcode-detector';
      setIsScannerOpen(true);
      setScannerMessage('Наведіть камеру на штрихкод товару.');
    } catch (cameraError) {
      stopScanner();
      setError(getInventoryScannerCameraErrorMessage(cameraError));
    } finally {
      isStartingScannerRef.current = false;
      setIsStartingScanner(false);
    }
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

      setUsers((prev) => prev.map((item) => (item.id === payload.user?.id ? payload.user : item)));
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
      setSuccess(`Термін придатності для "${payload.batch.productName}" змінено з ${payload.correction.oldExpiryDate} на ${payload.correction.newExpiryDate}.`);
      closeExpiryCorrectionModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося змінити термін придатності.');
    } finally {
      setIsSavingExpiryCorrection(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-3 py-4 sm:px-5 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <section className="rounded-[36px] border border-slate-200 bg-white px-4 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] sm:px-6 sm:py-6">
          <a
            href={`/inventory/tasks?token=${encodeURIComponent(token)}`}
            className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
          >
            <span aria-hidden="true">←</span>
            <span>До задач</span>
          </a>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm text-slate-500">{storeLabel || 'Магазин'}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.6rem]">Керування магазином</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                Оновлений мінімалістичний екран керування магазином. Тут залишаємо весь поточний функціонал: команду, режим задач,
                активні партії, прострочені товари та ручне підтвердження змін.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Оновити
              </button>
            </div>
          </div>
        </section>

        {isLoading ? <p className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">Завантаження даних магазину...</p> : null}
        {error ? <p className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</p> : null}
        {success ? <p className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</p> : null}

        {!isLoading && !error ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard value={String(activeUsers.length)} label={`Активних працівників із ${users.length}`} tone="soft" />
              <StatCard value={String(expiringBatches.length)} label="Партій у контролі до 30 днів" tone="warning" />
              <StatCard value={String(overdueBatchesCount)} label="Прострочених партій без підтвердженого закриття" tone="critical" />
              <StatCard value={formatRoleTitle(currentUserRole)} label="Ваша роль у магазині" tone="neutral" />
            </section>

            <SectionShell
              title="Налаштування"
              subtitle="Єдиний блок для пошуку, перемикання режиму задач і швидкого керування всіма списками на сторінці."
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="rounded-[28px] bg-slate-50 p-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Пошук по товарах, партіях і відповідальних</span>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input
                        value={manageFilter}
                        onChange={(event) => setManageFilter(event.target.value)}
                        placeholder="Назва, артикул, штрихкод, код поставки, працівник"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      />
                      {isScannerOpen ? (
                        <button
                          type="button"
                          onClick={stopScanner}
                          className="shrink-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Закрити камеру
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            void startScanner();
                          }}
                          disabled={isStartingScanner}
                          className="shrink-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition enabled:hover:bg-slate-50 disabled:opacity-60"
                        >
                          {isStartingScanner ? 'Відкриваємо камеру...' : 'Сканувати'}
                        </button>
                      )}
                    </div>
                  </label>
                  {scannerMessage ? <p className="mt-3 text-sm text-slate-700">{scannerMessage}</p> : null}
                  {isScannerOpen ? (
                    <div className="mt-4 rounded-[24px] border border-slate-300 bg-slate-950 p-3">
                      <div className="mx-auto flex max-w-sm justify-center overflow-hidden rounded-[20px] border border-slate-700 bg-black">
                        <video ref={videoRef} className="h-[320px] w-auto max-w-full object-contain bg-black" autoPlay muted playsInline />
                      </div>
                      <p className="mt-3 text-center text-xs text-slate-300">
                        Наведіть камеру на штрихкод. Після зчитування код автоматично підставиться в пошук.
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Фільтр одночасно застосовується до активних поставок і до списку партій, які вже в контролі по терміну придатності.
                  </p>
                </div>

                {canManageInventoryTaskMode(currentUserRole) ? (
                  <div className="rounded-[28px] bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Режим розподілу задач</p>
                        <p className="mt-1 text-xs text-slate-500">Обирай модель, за якою працівники отримують або бачать задачі.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSaveTaskAssignmentMode();
                        }}
                        disabled={isSavingTaskMode}
                        className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        {isSavingTaskMode ? 'Збереження...' : 'Зберегти'}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {taskAssignmentModeOptions.map((option) => {
                        const isSelected = taskAssignmentMode === option.value;
                        return (
                          <label
                            key={option.value}
                            className={`cursor-pointer rounded-[24px] border px-4 py-3 transition ${
                              isSelected ? 'border-slate-900 bg-white' : 'border-transparent bg-white/70 hover:border-slate-200'
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
                                <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionShell>

            <SectionShell
              title="Команда магазину"
              subtitle="Працівники, їх ролі, посади та активність. Блок можна тримати згорнутим, щоб не перевантажувати сторінку."
              count={`${activeUsers.length} активних`}
              actions={
                <button
                  type="button"
                  onClick={() => setIsUsersSectionOpen((prev) => !prev)}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {isUsersSectionOpen ? 'Згорнути' : 'Відкрити'}
                </button>
              }
            >
              {isUsersSectionOpen ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {users.map((user) => (
                    <article key={user.id} className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">
                            {user.surname} {user.name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">{user.positionTitle || 'Посада не вказана'}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{formatRoleLabel(user.role)}</span>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">chat_id: {user.userChatId || 'не вказано'}</div>

                        <input
                          value={user.positionTitle}
                          onChange={(event) =>
                            setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, positionTitle: event.target.value } : item)))
                          }
                          placeholder="Посада"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                          <select
                            value={user.role}
                            onChange={(event) =>
                              setUsers((prev) =>
                                prev.map((item) => (item.id === user.id ? { ...item, role: event.target.value as InventoryUserView['role'] } : item))
                              )
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                          >
                            <option value="staff">staff</option>
                            <option value="manager">manager</option>
                            <option value="store_manager">store_manager</option>
                            {currentUserRole === 'admin' ? <option value="admin">admin</option> : null}
                          </select>

                          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
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
                          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          {savingUserId === user.id ? 'Збереження...' : 'Оновити працівника'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  Список працівників приховано. Відкрий блок, якщо треба змінити роль, посаду або активність.
                </div>
              )}
            </SectionShell>

            <SectionShell
              title="Активні поставки"
              subtitle="Плоский список карток без вкладених блоків. Кожна картка веде в деталі товару, але основний список лишається легким і швидким для перегляду."
              count={`${sortedStoreBatches.length} карток`}
            >
              {storeBatches.length === 0 ? (
                <div className="rounded-[28px] bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">У поточному магазині ще немає внесених партій.</div>
              ) : sortedStoreBatches.length === 0 ? (
                <div className="rounded-[28px] bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">За поточним фільтром активних поставок не знайдено.</div>
              ) : (
                <div className="grid gap-4">
                  {sortedStoreBatches.map((batch) => (
                    <InventoryBatchCard
                      key={batch.id}
                      batch={batch}
                      token={token}
                      focusedBatchId={focusedBatchId}
                      currentUserRole={currentUserRole}
                      activeUsers={activeUsers}
                      assigningBatchId={assigningBatchId}
                      onReassign={handleReassign}
                    />
                  ))}
                </div>
              )}
            </SectionShell>

            <SectionShell
              title="Контроль термінів"
              subtitle="Тут залишаються прострочені та термінові партії, доки користувач реально не підтвердить дію. Це і є потрібна нам логіка контролю."
              count={`${sortedExpiringBatches.length} карток`}
              actions={
                <>
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">{overdueBatchesCount} прострочених</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{nearExpiryBatchesCount} термінових</span>
                </>
              }
            >
              {expiringBatches.length === 0 ? (
                <div className="rounded-[28px] bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">У магазині зараз немає партій зі строком до 30 днів.</div>
              ) : sortedExpiringBatches.length === 0 ? (
                <div className="rounded-[28px] bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">За поточним фільтром термінових товарів не знайдено.</div>
              ) : (
                <div className="grid gap-4">
                  {sortedExpiringBatches.map((batch) => (
                    <InventoryBatchCard
                      key={batch.id}
                      batch={batch}
                      token={token}
                      focusedBatchId={focusedBatchId}
                      currentUserRole={currentUserRole}
                      activeUsers={activeUsers}
                      assigningBatchId={assigningBatchId}
                      onReassign={handleReassign}
                    />
                  ))}
                </div>
              )}
            </SectionShell>
          </>
        ) : null}
      </div>

      {editingExpiryBatch ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-3 py-5">
          <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:p-6">
            <p className="text-sm text-slate-500">Коригування дати</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{editingExpiryBatch.productName}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Зміна терміну придатності зберігається в історію разом із причиною, коментарем, фото та користувачем, який виконав дію.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Стара дата</span>
                <input
                  value={editingExpiryBatch.expiryDate}
                  readOnly
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Нова дата</span>
                <input
                  type="date"
                  value={expiryCorrectionNewDate}
                  onChange={(event) => setExpiryCorrectionNewDate(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Причина зміни</span>
                <select
                  value={expiryCorrectionReason}
                  onChange={(event) => setExpiryCorrectionReason(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {expiryCorrectionReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-sm font-medium text-slate-700">Фото товару</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleExpiryCorrectionPhotoChange(event.target.files?.[0] ?? null)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                />
                <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Зробити фото
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => handleExpiryCorrectionPhotoChange(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  {expiryCorrectionPhotoFile?.name || (expiryCorrectionPhotoUrl ? 'Фото вже додано' : 'Фото обовʼязкове')}
                </p>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Коментар</span>
              <textarea
                value={expiryCorrectionComment}
                onChange={(event) => setExpiryCorrectionComment(event.target.value)}
                rows={4}
                placeholder="Опишіть, що саме перевірили і чому змінюєте дату."
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>

            <div className="mt-4 rounded-[24px] bg-slate-50 p-4 text-sm text-slate-600">
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
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveExpiryCorrection(false);
                }}
                disabled={isSavingExpiryCorrection}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSavingExpiryCorrection ? 'Збереження...' : 'Зберегти зміну'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingExpiryBatch && expiryCorrectionWarning ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-3 py-5">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] sm:p-6">
            <p className="text-sm text-amber-700">Підтвердження дати</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{expiryCorrectionWarning.title || 'Перевірте нову дату'}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">{expiryCorrectionWarning.message}</p>

            <div className="mt-4 rounded-[24px] bg-slate-50 p-4 text-sm text-slate-600">
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
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Повернутися
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveExpiryCorrection(true);
                }}
                disabled={isSavingExpiryCorrection}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
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
