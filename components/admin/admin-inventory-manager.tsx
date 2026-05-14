'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  getSuspiciousInventoryExpiryDate,
  type SuspiciousInventoryExpiryDate
} from '@/lib/inventory-expiry-date-rules';
import {
  buildInventoryWebhookUrl,
  defaultInventoryTelegramSettings,
  normalizeInventoryTelegramSettings,
  type InventoryTelegramSettings
} from '@/lib/inventory-telegram-settings';
import { type InventoryUserRole } from '@/lib/inventory-user-roles';
import type { InventoryReadiness } from '@/lib/inventory-schema';
import type { InventoryProductInput, InventoryProductRecord } from '@/lib/inventory-product-types';
import type { InventoryBatchInput, InventoryBatchRecord } from '@/lib/inventory-batch-types';
import type { StoreRecord } from '@/lib/store-types';

type ReadinessPayload = { ok?: boolean; readiness?: InventoryReadiness; error?: string };
type SettingsPayload = { ok?: boolean; settings?: Partial<InventoryTelegramSettings>; webhookUrl?: string; error?: string };
type ProductsPayload = {
  ok?: boolean;
  products?: InventoryProductRecord[];
  product?: InventoryProductRecord;
  totalCount?: number;
  categories?: string[];
  page?: number;
  limit?: number;
  error?: string;
};
type BatchesPayload = { ok?: boolean; batches?: InventoryBatchRecord[]; batch?: InventoryBatchRecord; error?: string };
type DuplicateBatchConflict = {
  id: string;
  productName: string;
  storeLabel: string;
  expiryDate: string;
  quantity: number;
  batchCode: string;
};
type BatchMutationResolution = 'created' | 'merged';
type IntakePayload = ProductsPayload &
  BatchesPayload & {
    duplicateBatch?: DuplicateBatchConflict;
    suspiciousExpiryDate?: SuspiciousInventoryExpiryDate;
    resolution?: BatchMutationResolution;
    usedExistingProduct?: boolean;
  };
type StoresPayload = { ok?: boolean; stores?: StoreRecord[]; error?: string };
type ProductImportPayload = {
  ok?: boolean;
  importJob?: {
    jobId: string;
    fileName: string;
    importedBy: string;
    state: 'queued' | 'processing' | 'completed' | 'failed';
    percent: number;
    message: string;
    totalRows: number;
    processedRows: number;
    startedAt: string;
    updatedAt: string;
    finishedAt: string;
    summary: NonNullable<ProductImportPayload['summary']> | null;
    importLog: ProductImportPayload['importLog'] | null;
    logWarning: string;
    error: string;
    failedRowNumber?: number;
    failedExcelRowNumber?: number;
    failedRowData?: {
      article: string;
      barcode: string;
      productName: string;
      unitsOfMeasurement: string;
      category?: string;
      notifiedDaysDefault?: number;
      isActive?: boolean;
    } | null;
  } | null;
  logWarning?: string;
  expectedLogDir?: string;
  importLog?: {
    fileName: string;
    importedBy: string;
    storedAt: string;
    logFileName: string;
    logFileUrl: string;
    summary: NonNullable<ProductImportPayload['summary']>;
  } | null;
  summary?: {
    created: number;
    updated: number;
    skipped: number;
    needsReview: number;
    total: number;
    productsCreated: number;
    productsUpdated: number;
    productsMatchedExisting: number;
    barcodeEntriesAdded: number;
    barcodeEntriesKept: number;
    invalidRows: number;
    log: Array<{
      rowNumber: number;
      article: string;
      productName: string;
      barcode: string;
      unitsOfMeasurement: string;
      status: 'created' | 'updated' | 'skipped' | 'review';
      message: string;
    }>;
  };
  items?: InventoryImportReviewView[];
  error?: string;
};
type ImportProgressState = {
  phase: 'idle' | 'uploading' | 'processing' | 'completed';
  percent: number;
  message: string;
};
type InventoryProductChangeLogView = {
  id: number;
  productId: number;
  productName: string;
  article: string;
  barcode: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changeSource: string;
  changedBy: string;
  changeNote: string;
  createdAt: string;
};
type ProductChangeLogsPayload = { ok?: boolean; items?: InventoryProductChangeLogView[]; error?: string };
type InventoryImportReviewView = {
  id: number;
  productId: number | null;
  article: string;
  productName: string;
  existingBarcode: string;
  incomingBarcode: string;
  issueType: string;
  status: string;
  note: string;
  resolvedNote: string;
  resolvedBy: string;
  resolvedAt: string;
  createdAt: string;
  updatedAt: string;
};
type ImportReviewPayload = { ok?: boolean; items?: InventoryImportReviewView[]; error?: string };
type ManualProductCreationView = {
  id: number;
  createdAt: string;
  comment: string;
  productId: number | null;
  productName: string;
  article: string;
  barcode: string;
  userId: number | null;
  userName: string;
  userSurname: string;
  storeId: number | null;
  storeLabel: string;
};
type ManualProductsPayload = { ok?: boolean; items?: ManualProductCreationView[]; error?: string };
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
type UsersPayload = { ok?: boolean; users?: InventoryUserView[]; error?: string };
type WebhookPayload = {
  ok?: boolean;
  configured?: boolean;
  webhookUrl?: string;
  info?: { url?: string; pending_update_count?: number; last_error_message?: string } | null;
  error?: string;
};
type InventoryNotificationDebugItem = {
  userId: number | null;
  name: string;
  role: string;
  chatId: string;
  taskIds: number[];
  stores: string[];
  active: number;
  critical: number;
  high: number;
  overdue: number;
  repeat: number;
  skipped: boolean;
  reason: string;
  sentCount: number;
  ok?: boolean;
  error?: string;
};
type NotificationsRunPayload = {
  ok?: boolean;
  result?: {
    candidates: number;
    batchesProcessed: number;
    notificationsSent: number;
    debug?: InventoryNotificationDebugItem[];
  };
  error?: string;
};
type InventoryNotificationLogView = {
  id: number;
  taskId: number | null;
  batchId: number | null;
  productId: number | null;
  storeId: number | null;
  userId: number | null;
  notificationType: string;
  messageText: string;
  status: string;
  openedAt: string;
  openedByUserId: number | null;
  sentAt: string;
  productName: string;
  article: string;
  batchCode: string;
  storeLabel: string;
  recipientName: string;
  openedByName: string;
};
type InventoryNotificationLogsPayload = {
  ok?: boolean;
  logs?: InventoryNotificationLogView[];
  error?: string;
};
type InventoryExpiryTaskView = {
  id: number;
  batchId: number;
  productId: number;
  storeId: number;
  responsibleUserId: number | null;
  taskType: string;
  status: string;
  riskLevel: string;
  dueDate: string;
  daysLeftSnapshot: number;
  title: string;
  note: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  lastNotifiedAt: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
  productName: string;
  article: string;
  barcode: string;
  batchCode: string;
  storeLabel: string;
  responsibleUserName: string;
};
type InventoryTasksPayload = {
  ok?: boolean;
  activeTasks?: InventoryExpiryTaskView[];
  archivedTasks?: InventoryExpiryTaskView[];
  summary?: {
    active: number;
    archived: number;
  };
  error?: string;
};
type InventorySectionId = 'overview' | 'schema' | 'product-list' | 'batches' | 'import' | 'intake' | 'operations' | 'analytics' | 'telegram';
type InventorySubsectionId =
  | 'overview'
  | 'product-list'
  | 'product-create'
  | 'product-import'
  | 'batches-list'
  | 'registered-employees'
  | 'employee-tasks'
  | 'batch-responsibility'
  | 'notifications'
  | 'analytics'
  | 'settings-schema'
  | 'settings-telegram';
type InventoryBatchGroup = {
  key: string;
  label: string;
  storeLabel: string;
  count: number;
  totalQuantity: number;
  batches: InventoryBatchRecord[];
};

type InventoryBatchView = 'all' | 'expiring' | 'overdue' | 'action-required' | 'written-off';

const inventorySubsectionToSection: Record<InventorySubsectionId, InventorySectionId> = {
  overview: 'overview',
  'product-list': 'product-list',
  'product-create': 'intake',
  'product-import': 'import',
  'batches-list': 'batches',
  'registered-employees': 'operations',
  'employee-tasks': 'operations',
  'batch-responsibility': 'operations',
  notifications: 'telegram',
  analytics: 'analytics',
  'settings-schema': 'schema',
  'settings-telegram': 'telegram'
};

const batchViewLabels: Record<InventoryBatchView, { title: string; description: string }> = {
  all: {
    title: 'Список партій',
    description: 'Поточний список поставок і партій по магазинах з можливістю швидко відкрити склад партії.'
  },
  expiring: {
    title: 'Закінчується термін',
    description: 'Партії, які вже потрапили в зону нагадування по терміну придатності.'
  },
  overdue: {
    title: 'Прострочені партії',
    description: 'Партії, у яких термін придатності вже минув.'
  },
  'action-required': {
    title: 'Потребують дії',
    description: 'Партії без реакції, які вже в зоні контролю або прострочені.'
  },
  'written-off': {
    title: 'Списані партії',
    description: 'Партії, які вже були відмічені як списані.'
  }
};

const initialProductForm: InventoryProductInput = {
  article: '',
  barcode: '',
  productName: '',
  unitsOfMeasurement: '',
  category: '',
  notifiedDaysDefault: 7,
  isActive: true
};
const initialBatchForm: InventoryBatchInput = {
  storeId: '',
  quantity: 1,
  expiryDate: '',
  deliveryDate: '',
  notifiedDays: null
};
const initialImportProgress: ImportProgressState = {
  phase: 'idle',
  percent: 0,
  message: ''
};

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
}

function getImportStatusLabel(status: 'created' | 'updated' | 'skipped' | 'review') {
  switch (status) {
    case 'created':
      return 'Створено';
    case 'updated':
      return 'Оновлено';
    case 'review':
      return 'Перевірити';
    default:
      return 'Пропущено';
  }
}

function getImportStatusClassName(status: 'created' | 'updated' | 'skipped' | 'review') {
  switch (status) {
    case 'created':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'updated':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'review':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function getImportProgressBarClassName(phase: ImportProgressState['phase']) {
  switch (phase) {
    case 'completed':
      return 'bg-emerald-500';
    case 'processing':
      return 'bg-sky-500';
    case 'uploading':
      return 'bg-brand';
    default:
      return 'bg-slate-300';
  }
}

function daysLeftUntil(value: string) {
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
}

function daysLeftUntilFromDate(value: string, referenceDate: string) {
  const target = new Date(`${value}T00:00:00`);
  const source = new Date(`${referenceDate}T00:00:00`);
  if (Number.isNaN(target.getTime()) || Number.isNaN(source.getTime())) {
    return daysLeftUntil(value);
  }
  return Math.floor((target.getTime() - source.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function storeLabel(store: StoreRecord) {
  return [store.storeCode, store.city, store.addressLine].filter(Boolean).join(' | ');
}

function formatProductChangeField(fieldName: string) {
  switch (fieldName) {
    case 'article':
      return 'Артикул';
    case 'barcode':
      return 'Штрихкод';
    case 'product_name':
      return 'Назва';
    case 'units_of_measurement':
      return 'Одиниця вимірювання';
    case 'category':
      return 'Категорія';
    case 'notified_days_default':
      return 'Днів до сповіщення';
    case 'is_active':
      return 'Активність';
    default:
      return fieldName;
  }
}

function formatProductBarcodes(barcodes?: string[], fallback = '') {
  const normalized = Array.isArray(barcodes) ? barcodes.filter(Boolean) : [];
  if (normalized.length > 0) return normalized.join(', ');
  return fallback || '—';
}

function formatInventoryUserRole(role: InventoryUserRole) {
  switch (role) {
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

function formatBatchCheckStatus(status: string) {
  switch (status) {
    case 'checked':
      return 'Перевірено';
    case 'writeoff':
      return 'Списано';
    case 'discussion':
      return 'Потребує рішення';
    default:
      return 'Нова';
  }
}

function formatExpiryTaskStatus(status: string) {
  switch (status) {
    case 'open':
      return 'Активна';
    case 'escalated':
      return 'Потребує рішення';
    case 'writeoff_pending':
      return 'На списанні';
    case 'completed':
      return 'Завершена';
    case 'cancelled':
      return 'Скасована';
    default:
      return status || '—';
  }
}

function getExpiryTaskStatusClassName(status: string) {
  switch (status) {
    case 'open':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'escalated':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'writeoff_pending':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'cancelled':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function formatExpiryTaskRiskLevel(level: string) {
  switch (level) {
    case 'critical':
      return 'Критичний';
    case 'high':
      return 'Високий';
    case 'medium':
      return 'Середній';
    case 'low':
      return 'Низький';
    default:
      return level || '—';
  }
}

function getExpiryTaskRiskClassName(level: string) {
  switch (level) {
    case 'critical':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'high':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'medium':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'low':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function formatNotificationLogStatus(status: string) {
  switch (status) {
    case 'opened':
      return 'Відкрито';
    case 'sent':
    default:
      return 'Надіслано';
  }
}

function formatNotificationLogType(type: string) {
  switch (type) {
    case 'inventory_task_digest':
      return 'Зведене сповіщення по задачах';
    case 'inventory_task_repeat':
      return 'Повторне нагадування';
    case 'inventory_expiry':
      return 'Сповіщення про термін';
    default:
      return type || '—';
  }
}

function formatDaysLeftLabel(daysLeft: number) {
  if (daysLeft < 0) return `Прострочено на ${Math.abs(daysLeft)} дн.`;
  if (daysLeft === 0) return 'Закінчується сьогодні';
  return `Ще ${daysLeft} дн.`;
}

function getTaskCompletionRatio(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

function groupInventoryBatchesBySupply(batches: InventoryBatchRecord[]): InventoryBatchGroup[] {
  const groups = new Map<string, InventoryBatchGroup>();

  for (const batch of batches) {
    const key = batch.batchCode.trim() ? `batch-code:${batch.batchCode.trim()}` : `single-batch:${batch.id}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        label: batch.batchCode.trim() || `Без коду поставки • партія #${batch.id}`,
        storeLabel: batch.storeLabel,
        count: 1,
        totalQuantity: batch.quantity,
        batches: [batch]
      });
      continue;
    }

    existing.count += 1;
    existing.totalQuantity += batch.quantity;
    existing.batches.push(batch);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      batches: [...group.batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || Number(a.id) - Number(b.id))
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'uk'));
}

function getBatchUrgencyMeta(batch: InventoryBatchRecord) {
  const daysLeft = daysLeftUntil(batch.expiryDate);

  if (batch.checkStatus === 'writeoff' || batch.actionTaken === 'writeoff') {
    return {
      daysLeft,
      label: 'Списано',
      className: 'border-slate-200 bg-slate-100 text-slate-700'
    };
  }

  if (daysLeft < 0) {
    return {
      daysLeft,
      label: `Прострочено на ${Math.abs(daysLeft)} дн.`,
      className: 'border-rose-200 bg-rose-50 text-rose-700'
    };
  }

  if (daysLeft <= Number(batch.notifiedDays || 7)) {
    return {
      daysLeft,
      label: `Закінчується через ${daysLeft} дн.`,
      className: 'border-amber-200 bg-amber-50 text-amber-700'
    };
  }

  return {
    daysLeft,
    label: `У запасі ${daysLeft} дн.`,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700'
  };
}

type AdminInventoryManagerProps = {
  initialSubsection?: InventorySubsectionId;
  initialBatchView?: InventoryBatchView;
};

export default function AdminInventoryManager({
  initialSubsection = 'overview',
  initialBatchView = 'all'
}: AdminInventoryManagerProps) {
  const [readiness, setReadiness] = useState<InventoryReadiness | null>(null);
  const [telegramSettings, setTelegramSettings] = useState<InventoryTelegramSettings>(defaultInventoryTelegramSettings);
  const [products, setProducts] = useState<InventoryProductRecord[]>([]);
  const [productsTotalCount, setProductsTotalCount] = useState(0);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(50);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [batches, setBatches] = useState<InventoryBatchRecord[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [inventoryUsers, setInventoryUsers] = useState<InventoryUserView[]>([]);
  const [inventoryActiveTasks, setInventoryActiveTasks] = useState<InventoryExpiryTaskView[]>([]);
  const [inventoryArchivedTasks, setInventoryArchivedTasks] = useState<InventoryExpiryTaskView[]>([]);
  const [manualProductCreations, setManualProductCreations] = useState<ManualProductCreationView[]>([]);
  const [productChangeLogs, setProductChangeLogs] = useState<InventoryProductChangeLogView[]>([]);
  const [importReviewItems, setImportReviewItems] = useState<InventoryImportReviewView[]>([]);
  const [productForm, setProductForm] = useState<InventoryProductInput>(initialProductForm);
  const [batchForm, setBatchForm] = useState<InventoryBatchInput>(initialBatchForm);
  const [batchNotifyOverride, setBatchNotifyOverride] = useState('');
  const [intakeDuplicateBatch, setIntakeDuplicateBatch] = useState<DuplicateBatchConflict | null>(null);
  const [intakeSuspiciousExpiryDateWarning, setIntakeSuspiciousExpiryDateWarning] = useState<SuspiciousInventoryExpiryDate | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [webhookInfo, setWebhookInfo] = useState<WebhookPayload['info']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [isRunningNotifications, setIsRunningNotifications] = useState(false);
  const [isLoadingInventoryTasks, setIsLoadingInventoryTasks] = useState(false);
  const [notificationsDebug, setNotificationsDebug] = useState<InventoryNotificationDebugItem[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<InventoryNotificationLogView[]>([]);
  const [isLoadingNotificationLogs, setIsLoadingNotificationLogs] = useState(false);
  const [notificationsStoreFilter, setNotificationsStoreFilter] = useState('');
  const [notificationsDateFrom, setNotificationsDateFrom] = useState(formatDateInputValue());
  const [notificationsDateTo, setNotificationsDateTo] = useState(formatDateInputValue());
  const [isCreatingIntake, setIsCreatingIntake] = useState(false);
  const [assigningBatchId, setAssigningBatchId] = useState('');
  const [savingInventoryUserId, setSavingInventoryUserId] = useState<number | null>(null);
  const [selectedBatchGroupKey, setSelectedBatchGroupKey] = useState('');
  const [selectedBatchModalUserKey, setSelectedBatchModalUserKey] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportingProducts, setIsImportingProducts] = useState(false);
  const [importSummary, setImportSummary] = useState<ProductImportPayload['summary'] | null>(null);
  const [latestImportLog, setLatestImportLog] = useState<ProductImportPayload['importLog'] | null>(null);
  const [importLogWarning, setImportLogWarning] = useState('');
  const [activeImportJobId, setActiveImportJobId] = useState('');
  const [importProgress, setImportProgress] = useState<ImportProgressState>(initialImportProgress);
  const [resolvingImportReviewId, setResolvingImportReviewId] = useState<number | null>(null);
  const [isApplied, setIsApplied] = useState(false);
  const [isSettingsSaved, setIsSettingsSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<InventorySectionId>(inventorySubsectionToSection[initialSubsection]);
  const [activeSubsection, setActiveSubsection] = useState<InventorySubsectionId>(initialSubsection);
  const [analyticsStoreId, setAnalyticsStoreId] = useState('');
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState(formatDateInputValue());
  const [analyticsDateTo, setAnalyticsDateTo] = useState(formatDateInputValue());
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function loadProducts(options?: { page?: number; q?: string; category?: string; limit?: number }) {
    const nextPage = options?.page ?? productPage;
    const nextQuery = options?.q ?? productSearchQuery;
    const nextCategory = options?.category ?? productCategoryFilter;
    const nextLimit = options?.limit ?? productPageSize;

    setIsLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(nextPage));
      params.set('limit', String(nextLimit));
      if (nextQuery.trim()) params.set('q', nextQuery.trim());
      if (nextCategory.trim()) params.set('category', nextCategory.trim());

      const response = await fetch(`/api/admin/inventory/products?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json()) as ProductsPayload;
      if (!response.ok || !payload.ok || !Array.isArray(payload.products)) {
        throw new Error(payload.error || 'Не вдалося завантажити список товарів.');
      }

      setProducts(payload.products);
      setProductsTotalCount(Number(payload.totalCount ?? payload.products.length));
      setProductCategories(Array.isArray(payload.categories) ? payload.categories : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити список товарів.');
    } finally {
      setIsLoadingProducts(false);
    }
  }

  async function loadInventoryTasks(options?: { responsibleUserId?: number | null; storeId?: string }) {
    const responsibleUserId = Number(options?.responsibleUserId ?? 0);
    if (!Number.isFinite(responsibleUserId) || responsibleUserId <= 0) {
      setInventoryActiveTasks([]);
      setInventoryArchivedTasks([]);
      return;
    }

    setIsLoadingInventoryTasks(true);
    try {
      const params = new URLSearchParams();
      params.set('responsibleUserId', String(responsibleUserId));
      params.set('limit', '250');
      if (options?.storeId?.trim()) {
        params.set('storeId', options.storeId.trim());
      }

      const response = await fetch(`/api/admin/inventory/tasks?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json()) as InventoryTasksPayload;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не вдалося завантажити задачі працівника.');
      }

      setInventoryActiveTasks(Array.isArray(payload.activeTasks) ? payload.activeTasks : []);
      setInventoryArchivedTasks(Array.isArray(payload.archivedTasks) ? payload.archivedTasks : []);
    } catch (loadError) {
      setInventoryActiveTasks([]);
      setInventoryArchivedTasks([]);
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити задачі працівника.');
    } finally {
      setIsLoadingInventoryTasks(false);
    }
  }

  async function loadNotificationLogs(options?: {
    storeId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    setIsLoadingNotificationLogs(true);
    try {
      const params = new URLSearchParams();
      const storeId = options?.storeId ?? notificationsStoreFilter;
      const dateFrom = options?.dateFrom ?? notificationsDateFrom;
      const dateTo = options?.dateTo ?? notificationsDateTo;
      params.set('limit', '300');
      if (storeId.trim()) params.set('storeId', storeId.trim());
      if (dateFrom.trim()) params.set('dateFrom', dateFrom.trim());
      if (dateTo.trim()) params.set('dateTo', dateTo.trim());

      const response = await fetch(`/api/admin/inventory/notifications?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json()) as InventoryNotificationLogsPayload;
      if (!response.ok || !payload.ok || !Array.isArray(payload.logs)) {
        throw new Error(payload.error || 'Не вдалося завантажити журнал сповіщень.');
      }

      setNotificationLogs(payload.logs);
    } catch (loadError) {
      setNotificationLogs([]);
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити журнал сповіщень.');
    } finally {
      setIsLoadingNotificationLogs(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12] = await Promise.all([
          fetch('/api/admin/inventory/readiness', { cache: 'no-store' }),
          fetch('/api/admin/inventory/settings', { cache: 'no-store' }),
          fetch('/api/admin/inventory/products', { cache: 'no-store' }),
          fetch('/api/admin/inventory/batches?limit=5000', { cache: 'no-store' }),
          fetch('/api/admin/stores', { cache: 'no-store' }),
          fetch('/api/admin/inventory/users?limit=300', { cache: 'no-store' }),
          fetch('/api/admin/inventory/webhook', { cache: 'no-store' }),
          fetch('/api/admin/inventory/manual-products?limit=100', { cache: 'no-store' }),
          fetch('/api/admin/inventory/product-change-logs?limit=40', { cache: 'no-store' }),
          fetch('/api/admin/inventory/import-review?status=pending&limit=100', { cache: 'no-store' }),
          fetch('/api/admin/inventory/products/import?latest=1', { cache: 'no-store' }),
          fetch(`/api/admin/inventory/notifications?limit=300&dateFrom=${encodeURIComponent(notificationsDateFrom)}&dateTo=${encodeURIComponent(notificationsDateTo)}`, { cache: 'no-store' })
        ]);

        const p1 = (await r1.json()) as ReadinessPayload;
        const p2 = (await r2.json()) as SettingsPayload;
        const p3 = (await r3.json()) as ProductsPayload;
        const p4 = (await r4.json()) as BatchesPayload;
        const p5 = (await r5.json()) as StoresPayload;
        const p6 = (await r6.json()) as UsersPayload;
        const p7 = (await r7.json()) as WebhookPayload;
        const p8 = (await r8.json()) as ManualProductsPayload;
        const p9 = (await r9.json()) as ProductChangeLogsPayload;
        const p10 = (await r10.json()) as ImportReviewPayload;
        const p11 = (await r11.json()) as ProductImportPayload;
        const p12 = (await r12.json()) as InventoryNotificationLogsPayload;

        if (!r1.ok || !p1.ok || !p1.readiness) throw new Error(p1.error || 'Не вдалося перевірити готовність inventory-модуля.');
        if (!r2.ok || !p2.ok) throw new Error(p2.error || 'Не вдалося завантажити Telegram-налаштування.');
        if (!r3.ok || !p3.ok || !Array.isArray(p3.products)) throw new Error(p3.error || 'Не вдалося завантажити товари.');
        if (!r4.ok || !p4.ok || !Array.isArray(p4.batches)) throw new Error(p4.error || 'Не вдалося завантажити партії.');
        if (!r5.ok || !p5.ok || !Array.isArray(p5.stores)) throw new Error(p5.error || 'Не вдалося завантажити магазини.');
        if (!r6.ok || !p6.ok || !Array.isArray(p6.users)) throw new Error(p6.error || 'Не вдалося завантажити працівників inventory-модуля.');
        if (!r8.ok || !p8.ok || !Array.isArray(p8.items)) throw new Error(p8.error || 'Не вдалося завантажити товари, створені працівниками.');
        if (!cancelled) {
          setReadiness(p1.readiness);
          setTelegramSettings(normalizeInventoryTelegramSettings(p2.settings));
          setProducts(p3.products);
          setProductsTotalCount(Number(p3.totalCount ?? p3.products.length));
          setProductCategories(Array.isArray(p3.categories) ? p3.categories : []);
          setBatches(p4.batches);
          setStores(p5.stores);
          setInventoryUsers(p6.users);
          setWebhookInfo(p7.ok ? p7.info ?? null : null);
          setManualProductCreations(p8.items);
          setProductChangeLogs(r9.ok && p9.ok && Array.isArray(p9.items) ? p9.items : []);
          setImportReviewItems(r10.ok && p10.ok && Array.isArray(p10.items) ? p10.items : []);
          setLatestImportLog(r11.ok && p11.ok ? p11.importLog ?? null : null);
          setImportSummary(r11.ok && p11.ok ? p11.importLog?.summary ?? null : null);
          setNotificationLogs(r12.ok && p12.ok && Array.isArray(p12.logs) ? p12.logs : []);
          setError('');
          setSuccess('');
          setIsApplied(false);
          setIsSettingsSaved(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити inventory-модуль.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeSubsection !== 'notifications') return;
    void loadNotificationLogs();
  }, [activeSubsection, notificationsStoreFilter, notificationsDateFrom, notificationsDateTo]);

  useEffect(() => {
    void loadProducts();
  }, [productPage, productPageSize, productCategoryFilter]);

  const existingTablesCount = useMemo(() => readiness?.tables.filter((item) => item.exists).length ?? 0, [readiness]);
  const missingTables = readiness?.tables.filter((item) => !item.exists).map((item) => item.name) ?? [];
  const missingProductBatchColumns = readiness?.productBatches.missingColumns ?? [];
  const productTotalPages = useMemo(
    () => Math.max(1, Math.ceil(productsTotalCount / Math.max(productPageSize, 1))),
    [productsTotalCount, productPageSize]
  );
  const webhookUrl = useMemo(() => buildInventoryWebhookUrl(telegramSettings), [telegramSettings]);
  const overviewMetrics = useMemo(() => {
    const rows = batches.map((batch) => {
      const daysLeft = daysLeftUntil(batch.expiryDate);
      const expiringSoonDays = Number(batch.notifiedDays || 7);
      const isOverdue = daysLeft < 0;
      const isExpiringSoon = daysLeft >= 0 && daysLeft <= expiringSoonDays;
      const needsAction = batch.checkStatus === 'new' && (isOverdue || isExpiringSoon);
      return {
        batch,
        daysLeft,
        isOverdue,
        isExpiringSoon,
        needsAction,
        isUnassigned: !batch.responsibleUserId
      };
    });

    const criticalBatches = [...rows]
      .filter((row) => row.isOverdue || row.isExpiringSoon || row.needsAction)
      .sort((a, b) => a.daysLeft - b.daysLeft || a.batch.expiryDate.localeCompare(b.batch.expiryDate) || Number(a.batch.id) - Number(b.batch.id))
      .slice(0, 5);

    return {
      totalProducts: productsTotalCount,
      totalBatches: batches.length,
      totalQuantity: batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0),
      totalStores: stores.length,
      totalUsers: inventoryUsers.length,
      manualProductsCount: manualProductCreations.length,
      pendingImportCount: importReviewItems.length,
      expiringSoonCount: rows.filter((row) => row.isExpiringSoon).length,
      overdueCount: rows.filter((row) => row.isOverdue).length,
      needsActionCount: rows.filter((row) => row.needsAction).length,
      unassignedCount: rows.filter((row) => row.isUnassigned).length,
      criticalBatches,
      hasSchemaIssues: !readiness?.allRequiredTablesPresent || (readiness?.productBatches.missingColumns?.length ?? 0) > 0
    };
  }, [batches, importReviewItems.length, inventoryUsers.length, manualProductCreations.length, productsTotalCount, readiness, stores.length]);

  const analyticsMetrics = useMemo(() => {
    const rangeStart = analyticsDateFrom && analyticsDateTo && analyticsDateFrom > analyticsDateTo ? analyticsDateTo : analyticsDateFrom;
    const rangeEnd = analyticsDateFrom && analyticsDateTo && analyticsDateFrom > analyticsDateTo ? analyticsDateFrom : analyticsDateTo;

    const scopedBatches = analyticsStoreId
      ? batches.filter((batch) => String(batch.storeId) === analyticsStoreId)
      : batches;

    const relevantBatches = scopedBatches.filter((batch) => {
      if (!rangeStart && !rangeEnd) return true;
      const expiryDate = String(batch.expiryDate || '').trim();
      if (!expiryDate) return false;
      if (rangeStart && expiryDate < rangeStart) return false;
      if (rangeEnd && expiryDate > rangeEnd) return false;
      return true;
    });

    const batchRows = relevantBatches.map((batch) => {
      const daysLeft = daysLeftUntilFromDate(batch.expiryDate, rangeEnd || formatDateInputValue());
      const expiringSoonDays = Number(batch.notifiedDays || 7);
      const isOverdue = daysLeft < 0;
      const isExpiringSoon = daysLeft >= 0 && daysLeft <= expiringSoonDays;
      const needsAttention = batch.checkStatus === 'new' && (isOverdue || isExpiringSoon);
      const isWriteoff = batch.checkStatus === 'writeoff' || batch.actionTaken === 'writeoff';
      const isDiscussion = batch.checkStatus === 'discussion_required' || batch.discussionRequired;
      const isChecked = batch.checkStatus === 'checked';

      return {
        batch,
        daysLeft,
        isOverdue,
        isExpiringSoon,
        needsAttention,
        isWriteoff,
        isDiscussion,
        isChecked
      };
    });

    const stockReceived = scopedBatches.reduce((sum, batch) => sum + Number(batch.quantityReceived || 0), 0);
    const stockCurrent = scopedBatches.reduce((sum, batch) => sum + Number(batch.quantityCurrent || batch.quantity || 0), 0);
    const uniqueRiskStores = new Set(batchRows.filter((row) => row.isOverdue || row.isExpiringSoon).map((row) => row.batch.storeLabel).filter(Boolean));

    const statusCards = {
      new: batchRows.filter((row) => row.batch.checkStatus === 'new').length,
      checked: batchRows.filter((row) => row.isChecked).length,
      writeoff: batchRows.filter((row) => row.isWriteoff).length,
      discussion: batchRows.filter((row) => row.isDiscussion).length
    };

    const riskCards = {
      critical: batchRows.filter((row) => row.daysLeft <= 1 && !row.isWriteoff).length,
      high: batchRows.filter((row) => row.daysLeft > 1 && row.daysLeft <= 3 && !row.isWriteoff).length,
      medium: batchRows.filter((row) => row.daysLeft > 3 && row.daysLeft <= 7 && !row.isWriteoff).length,
      safe: batchRows.filter((row) => row.daysLeft > 7 && !row.isWriteoff).length,
      overdue: batchRows.filter((row) => row.isOverdue && !row.isWriteoff).length
    };

    const scopedStores = analyticsStoreId
      ? stores.filter((store) => String(store.id) === analyticsStoreId)
      : stores;

    const storeRows = scopedStores
      .map((store) => {
        const label = storeLabel(store);
        const storeBatches = scopedBatches.filter((batch) => batch.storeId === String(store.id));
        const periodStoreRows = batchRows.filter((row) => row.batch.storeId === String(store.id));
        const overdue = periodStoreRows.filter((row) => row.isOverdue && !row.isWriteoff).length;
        const expiring = periodStoreRows.filter((row) => row.isExpiringSoon && !row.isWriteoff).length;
        const attention = periodStoreRows.filter((row) => row.needsAttention).length;
        const currentQuantity = storeBatches.reduce((sum, batch) => sum + Number(batch.quantityCurrent || batch.quantity || 0), 0);

        return {
          id: store.id,
          label,
          batches: storeBatches.length,
          overdue,
          expiring,
          attention,
          currentQuantity
        };
      })
      .filter((row) => row.batches > 0)
      .sort((a, b) => b.attention - a.attention || b.overdue - a.overdue || b.batches - a.batches)
      .slice(0, 8);

    const scopedUsers = analyticsStoreId
      ? inventoryUsers.filter((user) => String(user.storeId ?? '') === analyticsStoreId)
      : inventoryUsers;

    const employeeRows = scopedUsers
      .map((user) => {
        const responsibleBatches = scopedBatches.filter((batch) => Number(batch.responsibleUserId || 0) === user.id);
        const responsibleRows = batchRows.filter((row) => Number(row.batch.responsibleUserId || 0) === user.id);
        const attention = responsibleRows.filter((row) => row.isOverdue || row.isExpiringSoon || row.isDiscussion || row.isChecked).length;
        const completed = responsibleRows.filter((row) => row.isChecked || row.isWriteoff || row.isDiscussion).length;
        const overdue = responsibleRows.filter((row) => row.isOverdue && !row.isWriteoff).length;
        const expiring = responsibleRows.filter((row) => row.isExpiringSoon && !row.isWriteoff).length;
        const completionRatio = getTaskCompletionRatio(completed, attention);

        return {
          id: user.id,
          name: `${user.surname} ${user.name}`.trim(),
          storeLabel: user.storeLabel,
          role: formatInventoryUserRole(user.role),
          responsibleCount: responsibleBatches.length,
          attention,
          completed,
          overdue,
          expiring,
          completionRatio
        };
      })
      .filter((row) => row.responsibleCount > 0)
      .sort((a, b) => b.attention - a.attention || b.overdue - a.overdue || b.completionRatio - a.completionRatio)
      .slice(0, 8);

    return {
      stockReceived,
      stockCurrent,
      stockDelta: stockReceived - stockCurrent,
      uniqueRiskStoresCount: uniqueRiskStores.size,
      totalBatches: scopedBatches.length,
      periodBatches: relevantBatches.length,
      totalUsers: scopedUsers.length,
      analyticsDateFrom: rangeStart,
      analyticsDateTo: rangeEnd,
      analyticsStoreId,
      statusCards,
      riskCards,
      storeRows,
      employeeRows
    };
  }, [analyticsDateFrom, analyticsDateTo, analyticsStoreId, batches, inventoryUsers, stores]);

  useEffect(() => {
    if (productPage > productTotalPages) {
      setProductPage(productTotalPages);
    }
  }, [productPage, productTotalPages]);

  const selectedStoreUsers = useMemo(
    () => (!selectedStoreId ? inventoryUsers : inventoryUsers.filter((user) => String(user.storeId ?? '') === selectedStoreId)),
    [inventoryUsers, selectedStoreId]
  );
  const [selectedInventoryUserId, setSelectedInventoryUserId] = useState<number | null>(null);
  const batchViewMeta = batchViewLabels[initialBatchView];
  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const daysLeft = daysLeftUntil(batch.expiryDate);
      const expiringSoonDays = Number(batch.notifiedDays || 7);
      const isOverdue = daysLeft < 0;
      const isExpiringSoon = daysLeft >= 0 && daysLeft <= expiringSoonDays;
      const isWrittenOff = batch.checkStatus === 'writeoff' || batch.actionTaken === 'writeoff';
      const needsAction = batch.checkStatus === 'new' && (isOverdue || isExpiringSoon);

      switch (initialBatchView) {
        case 'expiring':
          return isExpiringSoon && !isWrittenOff;
        case 'overdue':
          return isOverdue && !isWrittenOff;
        case 'action-required':
          return needsAction && !isWrittenOff;
        case 'written-off':
          return isWrittenOff;
        case 'all':
        default:
          return true;
      }
    });
  }, [batches, initialBatchView]);
  const selectedStoreBatches = useMemo(
    () => (!selectedStoreId ? filteredBatches : filteredBatches.filter((batch) => batch.storeId === selectedStoreId)),
    [filteredBatches, selectedStoreId]
  );
  const selectedStoreBatchGroups = useMemo(
    () => groupInventoryBatchesBySupply(selectedStoreBatches),
    [selectedStoreBatches]
  );
  const selectedInventoryUser = useMemo(() => {
    if (selectedStoreUsers.length === 0) return null;
    return selectedStoreUsers.find((user) => user.id === selectedInventoryUserId) ?? selectedStoreUsers[0] ?? null;
  }, [selectedInventoryUserId, selectedStoreUsers]);
  const selectedInventoryUserCreatedProducts = useMemo(
    () => manualProductCreations.filter((item) => item.userId === selectedInventoryUser?.id),
    [manualProductCreations, selectedInventoryUser]
  );
  const selectedInventoryUserCreatedBatches = useMemo(
    () => selectedStoreBatches.filter((batch) => Number(batch.createdByUserId || 0) === selectedInventoryUser?.id),
    [selectedStoreBatches, selectedInventoryUser]
  );
  const selectedInventoryUserResponsibleBatches = useMemo(
    () => selectedStoreBatches.filter((batch) => Number(batch.responsibleUserId || 0) === selectedInventoryUser?.id),
    [selectedStoreBatches, selectedInventoryUser]
  );
  const selectedInventoryUserBatchGroups = useMemo(
    () => groupInventoryBatchesBySupply(selectedInventoryUserResponsibleBatches),
    [selectedInventoryUserResponsibleBatches]
  );
  const selectedBatchGroup = useMemo(() => {
    const preferredGroups =
      activeSection === 'operations' && selectedInventoryUser ? selectedInventoryUserBatchGroups : selectedStoreBatchGroups;
    return preferredGroups.find((group) => group.key === selectedBatchGroupKey) ?? null;
  }, [activeSection, selectedBatchGroupKey, selectedInventoryUser, selectedInventoryUserBatchGroups, selectedStoreBatchGroups]);
  const selectedBatchGroupUserRows = useMemo(() => {
    if (!selectedBatchGroup) return [];

    const storeIds = new Set(selectedBatchGroup.batches.map((batch) => batch.storeId));
    const counts = new Map<string, number>();
    for (const batch of selectedBatchGroup.batches) {
      const key = batch.createdByUserId ? `user:${batch.createdByUserId}` : 'unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const rows = inventoryUsers
      .filter((user) => user.storeId != null && storeIds.has(String(user.storeId)))
      .map((user) => ({
        key: `user:${user.id}`,
        label: `${user.surname} ${user.name}`.trim(),
        caption: [user.positionTitle, user.role].filter(Boolean).join(' | '),
        count: counts.get(`user:${user.id}`) ?? 0
      }));

    if ((counts.get('unknown') ?? 0) > 0) {
      rows.push({
        key: 'unknown',
        label: 'Не визначено',
        caption: 'Записи без created_by_user_id',
        count: counts.get('unknown') ?? 0
      });
    }

    return rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'uk'));
  }, [inventoryUsers, selectedBatchGroup]);
  const activeBatchModalUserKey = useMemo(() => {
    if (selectedBatchGroupUserRows.some((row) => row.key === selectedBatchModalUserKey)) {
      return selectedBatchModalUserKey;
    }

    return selectedBatchGroupUserRows[0]?.key ?? '';
  }, [selectedBatchGroupUserRows, selectedBatchModalUserKey]);
  const selectedBatchModalBatches = useMemo(() => {
    if (!selectedBatchGroup || !activeBatchModalUserKey) return [];

    return selectedBatchGroup.batches.filter((batch) => {
      if (activeBatchModalUserKey === 'unknown') {
        return !batch.createdByUserId;
      }

      return `user:${batch.createdByUserId}` === activeBatchModalUserKey;
    });
  }, [activeBatchModalUserKey, selectedBatchGroup]);
  const selectedInventoryUserStats = useMemo(() => {
    if (!selectedInventoryUser) return null;

    const createdBatches = selectedInventoryUserCreatedBatches;
    const responsibleBatches = selectedInventoryUserResponsibleBatches;
    const nowIso = new Date().toISOString();
    const recentDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date.toISOString().slice(0, 10);
    });

    const manualProductsByDay = new Map<string, number>();
    for (const item of selectedInventoryUserCreatedProducts) {
      const key = item.createdAt.slice(0, 10);
      manualProductsByDay.set(key, (manualProductsByDay.get(key) ?? 0) + 1);
    }

    const createdBatchesByDay = new Map<string, number>();
    for (const batch of createdBatches) {
      const key = batch.createdAt.slice(0, 10);
      createdBatchesByDay.set(key, (createdBatchesByDay.get(key) ?? 0) + 1);
    }

    const activityTrend = recentDays.map((dayKey) => ({
      dayKey,
      label: formatDate(dayKey).slice(0, 5),
      manualProducts: manualProductsByDay.get(dayKey) ?? 0,
      batchesCreated: createdBatchesByDay.get(dayKey) ?? 0
    }));

    const totalCreatedQuantity = createdBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
    const totalResponsibleQuantity = responsibleBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);

    const responsibleBuckets = responsibleBatches.reduce(
      (acc, batch) => {
        const daysLeft = daysLeftUntil(batch.expiryDate);
        const isCompleted =
          batch.checkStatus === 'checked' || batch.checkStatus === 'writeoff' || batch.actionTaken === 'writeoff';
        const isDiscussion = batch.discussionRequired || batch.checkStatus === 'discussion';
        const isOverdue = daysLeft < 0;
        const isExpiring = daysLeft >= 0 && daysLeft <= Number(batch.notifiedDays || 7);

        if (isCompleted) {
          acc.completed.push(batch);
        } else if (isDiscussion) {
          acc.discussion.push(batch);
        } else if (isOverdue) {
          acc.overdue.push(batch);
        } else if (isExpiring) {
          acc.expiring.push(batch);
        } else if (batch.checkStatus === 'new') {
          acc.pending.push(batch);
        }

        return acc;
      },
      {
        overdue: [] as InventoryBatchRecord[],
        expiring: [] as InventoryBatchRecord[],
        discussion: [] as InventoryBatchRecord[],
        completed: [] as InventoryBatchRecord[],
        pending: [] as InventoryBatchRecord[]
      }
    );

    const overdueResponsible = responsibleBuckets.overdue;
    const expiringResponsible = responsibleBuckets.expiring;
    const discussionResponsible = responsibleBuckets.discussion;
    const completedResponsible = responsibleBuckets.completed;
    const pendingResponsible = responsibleBuckets.pending;
    const attentionRequiredCount =
      overdueResponsible.length + expiringResponsible.length + discussionResponsible.length + completedResponsible.length;
    const completionRatio = getTaskCompletionRatio(completedResponsible.length, attentionRequiredCount);
    const latestManualProductAt = selectedInventoryUserCreatedProducts[0]?.createdAt || '';
    const latestCreatedBatchAt = [...createdBatches]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((batch) => batch.createdAt)[0] || '';

    const workloadSegments = [
      {
        label: 'Нові',
        value: pendingResponsible.length,
        className: 'bg-sky-500'
      },
      {
        label: 'Прострочені',
        value: overdueResponsible.length,
        className: 'bg-rose-500'
      },
      {
        label: 'Закінчуються',
        value: expiringResponsible.length,
        className: 'bg-amber-500'
      },
      {
        label: 'Розв’язані',
        value: completedResponsible.length,
        className: 'bg-emerald-500'
      }
    ];

    const maxTrendValue = Math.max(
      1,
      ...activityTrend.map((item) => Math.max(item.manualProducts, item.batchesCreated))
    );

    return {
      createdProductsCount: selectedInventoryUserCreatedProducts.length,
      createdBatchesCount: createdBatches.length,
      responsibleBatchesCount: responsibleBatches.length,
      totalCreatedQuantity,
      totalResponsibleQuantity,
      overdueResponsibleCount: overdueResponsible.length,
      expiringResponsibleCount: expiringResponsible.length,
      discussionResponsibleCount: discussionResponsible.length,
      completedResponsibleCount: completedResponsible.length,
      pendingResponsibleCount: pendingResponsible.length,
      attentionRequiredCount,
      completionRatio,
      latestManualProductAt,
      latestCreatedBatchAt,
      activityTrend,
      maxTrendValue,
      workloadSegments
    };
  }, [selectedInventoryUser, selectedInventoryUserCreatedBatches, selectedInventoryUserCreatedProducts, selectedInventoryUserResponsibleBatches]);
  const selectedInventoryUserRecentActions = useMemo(() => {
    if (!selectedInventoryUser) return [];

    const manualProductActions = selectedInventoryUserCreatedProducts.map((item) => ({
      key: `manual-product-${item.id}`,
      createdAt: item.createdAt,
      type: 'manual-product' as const,
      title: item.productName || 'Товар без назви',
      subtitle: `Створено товар вручну${item.article ? ` • арт. ${item.article}` : ''}${item.barcode ? ` • ШК ${item.barcode}` : ''}`,
      note: item.comment || ''
    }));

    const batchActions = selectedInventoryUserCreatedBatches.map((batch) => ({
      key: `created-batch-${batch.id}`,
      createdAt: batch.createdAt,
      type: 'created-batch' as const,
      title: batch.productName || 'Партія без назви',
      subtitle: `Додано партію #${batch.id}${batch.batchCode ? ` • код ${batch.batchCode}` : ''} • кількість ${batch.quantity}`,
      note: batch.storeLabel || ''
    }));

    return [...manualProductActions, ...batchActions]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);
  }, [selectedInventoryUser, selectedInventoryUserCreatedBatches, selectedInventoryUserCreatedProducts]);
  const selectedInventoryUserTaskList = useMemo(() => {
    return [...selectedInventoryUserResponsibleBatches]
      .map((batch) => {
        const urgency = getBatchUrgencyMeta(batch);
        const isCompleted =
          batch.checkStatus === 'checked' || batch.checkStatus === 'writeoff' || batch.actionTaken === 'writeoff';

        return {
          ...batch,
          daysLeft: urgency.daysLeft,
          urgencyLabel: urgency.label,
          urgencyClassName: urgency.className,
          isCompleted
        };
      })
      .sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
        return a.productName.localeCompare(b.productName, 'uk');
      });
  }, [selectedInventoryUserResponsibleBatches]);
  const selectedInventoryUserTaskSummary = useMemo(() => {
    const overdueActiveTasks = inventoryActiveTasks.filter((task) => Number(task.daysLeftSnapshot) < 0).length;
    const criticalActiveTasks = inventoryActiveTasks.filter((task) => task.riskLevel === 'critical').length;
    const escalatedActiveTasks = inventoryActiveTasks.filter((task) => task.status === 'escalated').length;
    const writeoffPendingTasks = inventoryActiveTasks.filter((task) => task.status === 'writeoff_pending').length;
    const completedArchivedTasks = inventoryArchivedTasks.filter((task) => task.status === 'completed').length;
    const cancelledArchivedTasks = inventoryArchivedTasks.filter((task) => task.status === 'cancelled').length;

    return {
      totalActive: inventoryActiveTasks.length,
      overdueActiveTasks,
      criticalActiveTasks,
      escalatedActiveTasks,
      writeoffPendingTasks,
      totalArchived: inventoryArchivedTasks.length,
      completedArchivedTasks,
      cancelledArchivedTasks
    };
  }, [inventoryActiveTasks, inventoryArchivedTasks]);

  useEffect(() => {
    if (selectedStoreUsers.length === 0) {
      setSelectedInventoryUserId(null);
      return;
    }
    if (!selectedStoreUsers.some((user) => user.id === selectedInventoryUserId)) {
      setSelectedInventoryUserId(selectedStoreUsers[0].id);
    }
  }, [selectedInventoryUserId, selectedStoreUsers]);

  useEffect(() => {
    if (activeSubsection !== 'employee-tasks') return;
    if (!selectedInventoryUser) {
      setInventoryActiveTasks([]);
      setInventoryArchivedTasks([]);
      return;
    }

    void loadInventoryTasks({
      responsibleUserId: selectedInventoryUser.id,
      storeId: selectedStoreId
    });
  }, [activeSubsection, selectedInventoryUser, selectedStoreId]);

  async function handleApplyMigrations() {
    setIsApplying(true);
    setIsApplied(false);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/inventory/migrate', { method: 'POST' });
      const payload = (await response.json()) as ReadinessPayload;
      if (!response.ok || !payload.ok || !payload.readiness) {
        throw new Error(payload.error || 'Не вдалося застосувати inventory-міграції.');
      }
      setReadiness(payload.readiness);
      setIsApplied(true);
      setSuccess('Inventory-міграції застосовано.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося застосувати inventory-міграції.');
    } finally {
      setIsApplying(false);
    }
  }

  function updateTelegramSetting<K extends keyof InventoryTelegramSettings>(key: K, value: InventoryTelegramSettings[K]) {
    setTelegramSettings((prev) => ({ ...prev, [key]: value }));
    setIsSettingsSaved(false);
    if (error) setError('');
  }

  async function handleSaveTelegramSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSettings(true);
    setIsSettingsSaved(false);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/inventory/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: telegramSettings })
      });
      const payload = (await response.json()) as SettingsPayload;
      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.error || 'Не вдалося зберегти Telegram-налаштування.');
      }
      setTelegramSettings(normalizeInventoryTelegramSettings(payload.settings));
      setIsSettingsSaved(true);
      setSuccess('Telegram-налаштування збережено.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти Telegram-налаштування.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleRegisterWebhook() {
    setIsRegisteringWebhook(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/inventory/webhook', { method: 'POST' });
      const payload = (await response.json()) as WebhookPayload;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не вдалося зареєструвати webhook.');
      }
      setWebhookInfo(payload.info ?? null);
      setSuccess(`Webhook зареєстровано: ${payload.webhookUrl || ''}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зареєструвати webhook.');
    } finally {
      setIsRegisteringWebhook(false);
    }
  }

  async function handleRunNotifications() {
    setIsRunningNotifications(true);
    setError('');
    setSuccess('');
    setNotificationsDebug([]);
    try {
      const response = await fetch('/api/admin/inventory/notifications/run', { method: 'POST' });
      const payload = (await response.json()) as NotificationsRunPayload;
      if (!response.ok || !payload.ok || !payload.result) {
        throw new Error(payload.error || 'Не вдалося запустити Telegram-сповіщення.');
      }
      setSuccess(
        `Сповіщення виконано. Кандидатів: ${payload.result.candidates}. Оброблено партій: ${payload.result.batchesProcessed}. Надіслано повідомлень: ${payload.result.notificationsSent}.`
      );
      setNotificationsDebug(payload.result.debug ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося запустити Telegram-сповіщення.');
    } finally {
      setIsRunningNotifications(false);
    }
  }

  async function handleCreateIntake(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitIntake();
  }

  function upsertBatchInState(batch: InventoryBatchRecord) {
    setBatches((prev) => {
      const next = prev.some((item) => item.id === batch.id)
        ? prev.map((item) => (item.id === batch.id ? batch : item))
        : [batch, ...prev];
      return next.slice(0, 100);
    });
  }

  async function submitIntake(duplicateAction?: 'merge' | 'create_anyway', confirmSuspiciousExpiryDate = false) {
    setIsCreatingIntake(true);
    setError('');
    setSuccess('');
    try {
      const normalizedExpiryDate = String(batchForm.expiryDate ?? '').trim();
      const normalizedDeliveryDate = String(batchForm.deliveryDate ?? '').trim();
      if (!confirmSuspiciousExpiryDate) {
        const localSuspiciousExpiryDate = getSuspiciousInventoryExpiryDate({
          expiryDate: normalizedExpiryDate,
          deliveryDate: normalizedDeliveryDate
        });
        if (localSuspiciousExpiryDate.isSuspicious) {
          setIntakeSuspiciousExpiryDateWarning(localSuspiciousExpiryDate);
          return;
        }
      }
      const response = await fetch('/api/admin/inventory/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: productForm,
          batch: {
            storeId: batchForm.storeId,
            batchCode: batchForm.batchCode,
            quantity: batchForm.quantity,
            expiryDate: normalizedExpiryDate,
            deliveryDate: normalizedDeliveryDate,
            notifiedDays: batchNotifyOverride.trim() === '' ? null : batchNotifyOverride
          },
          duplicateAction,
          confirmSuspiciousExpiryDate
        })
      });
      const payload = (await response.json()) as IntakePayload;
      if (response.status === 428 && payload.suspiciousExpiryDate) {
        setIntakeSuspiciousExpiryDateWarning(payload.suspiciousExpiryDate);
        return;
      }
      if (response.status === 409 && payload.duplicateBatch) {
        setIntakeDuplicateBatch(payload.duplicateBatch);
        return;
      }
      if (!response.ok || !payload.ok || !payload.product || !payload.batch) {
        throw new Error(payload.error || 'Не вдалося створити товар і партію.');
      }
      await loadProducts();
      upsertBatchInState(payload.batch as InventoryBatchRecord);
      setProductForm(initialProductForm);
      setBatchForm(initialBatchForm);
      setBatchNotifyOverride('');
      setIntakeDuplicateBatch(null);
      setIntakeSuspiciousExpiryDateWarning(null);
      if (payload.resolution === 'merged') {
        setSuccess(
          `Кількість додано до існуючої партії "${payload.batch.productName}" до ${payload.batch.expiryDate}. Нова кількість: ${payload.batch.quantity}.`
        );
      } else if (payload.usedExistingProduct) {
        setSuccess(`Існуючий товар "${payload.product.productName}" використано, окрему партію додано.`);
      } else {
        setSuccess(`Товар "${payload.product.productName}" і першу партію додано.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося створити товар і партію.');
    } finally {
      setIsCreatingIntake(false);
    }
  }

  async function handleAssignResponsible(batchId: string, responsibleUserId: string) {
    setAssigningBatchId(batchId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/inventory/batches/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, responsibleUserId: responsibleUserId || null })
      });
      const payload = (await response.json()) as BatchesPayload;
      if (!response.ok || !payload.ok || !payload.batch) {
        throw new Error(payload.error || 'Не вдалося переназначити відповідального.');
      }
      setBatches((prev) => prev.map((item) => (item.id === payload.batch?.id ? (payload.batch as InventoryBatchRecord) : item)));
      setSuccess('Відповідального по партії оновлено.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося переназначити відповідального.');
    } finally {
      setAssigningBatchId('');
    }
  }

  async function handleSaveInventoryUser(user: InventoryUserView) {
    setSavingInventoryUserId(user.id);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/inventory/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          storeId: user.storeId,
          role: user.role,
          positionTitle: user.positionTitle,
          isActive: user.isActive
        })
      });
      const payload = (await response.json()) as { ok?: boolean; user?: InventoryUserView; error?: string };
      if (!response.ok || !payload.ok || !payload.user) {
        throw new Error(payload.error || 'Не вдалося оновити працівника.');
      }

      setInventoryUsers((prev) => prev.map((item) => (item.id === payload.user?.id ? (payload.user as InventoryUserView) : item)));
      setSuccess(`Працівника ${payload.user.surname} ${payload.user.name} оновлено.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося оновити працівника.');
    } finally {
      setSavingInventoryUserId(null);
    }
  }

  async function handleImportProducts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) {
      setError('Оберіть .xlsx файл для імпорту.');
      return;
    }

    setIsImportingProducts(true);
    setError('');
    setSuccess('');
    setImportSummary(null);
    setLatestImportLog(null);
    setImportLogWarning('');
    setActiveImportJobId('');
    setImportProgress({
      phase: 'uploading',
      percent: 0,
      message: 'Завантажуємо файл на сервер...'
    });

    try {
      const formData = new FormData();
      formData.set('file', importFile);
      const payload = await new Promise<ProductImportPayload>((resolve, reject) => {
        const request = new XMLHttpRequest();

        request.open('POST', '/api/admin/inventory/products/import');
        request.responseType = 'json';

        request.upload.onprogress = (progressEvent) => {
          if (!progressEvent.lengthComputable) {
            setImportProgress({
              phase: 'uploading',
              percent: 15,
              message: 'Завантажуємо файл на сервер...'
            });
            return;
          }

          const uploadPercent = Math.min(Math.round((progressEvent.loaded / progressEvent.total) * 70), 70);
          setImportProgress({
            phase: 'uploading',
            percent: uploadPercent,
            message: `Завантажуємо файл на сервер... ${uploadPercent}%`
          });
        };

        request.onload = () => {
          const responsePayload =
            request.response && typeof request.response === 'object'
              ? (request.response as ProductImportPayload)
              : (JSON.parse(String(request.responseText || '{}')) as ProductImportPayload);

          if (request.status < 200 || request.status >= 300 || !responsePayload.ok || !responsePayload.importJob?.jobId) {
            reject(new Error(responsePayload.error || 'Не вдалося імпортувати товари з Excel.'));
            return;
          }

          resolve(responsePayload);
        };

        request.onerror = () => {
          reject(new Error('Не вдалося імпортувати товари з Excel.'));
        };

        request.send(formData);
      });
      const job = payload.importJob;
      if (!job?.jobId) {
        throw new Error('Не вдалося запустити задачу імпорту.');
      }

      const jobId = job.jobId;
      setActiveImportJobId(jobId);
      setImportProgress({
        phase: 'processing',
        percent: Math.max(job.percent, 72),
        message: job.message || 'Файл отримано. Обробляємо товари і баркоди...'
      });

      let completedJob: NonNullable<ProductImportPayload['importJob']> | null = null;
      while (!completedJob) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        const statusResponse = await fetch(
          `/api/admin/inventory/products/import?jobId=${encodeURIComponent(jobId)}&advance=1`,
          { cache: 'no-store' }
        );
        const statusPayload = (await statusResponse.json()) as ProductImportPayload;
        if (!statusResponse.ok || !statusPayload.ok || !statusPayload.importJob) {
          throw new Error(statusPayload.error || 'Не вдалося отримати статус імпорту.');
        }

        const job = statusPayload.importJob;
        setImportProgress({
          phase: job.state === 'completed' ? 'completed' : 'processing',
          percent: Math.max(job.percent, 72),
          message: job.message || 'Обробляємо товари і баркоди...'
        });

        if (job.state === 'failed') {
          throw new Error(job.error || 'Імпорт зупинено через помилку.');
        }

        if (job.state === 'completed') {
          completedJob = job;
        }
      }

      await loadProducts();

      const [logsResponse, reviewResponse] = await Promise.all([
        fetch('/api/admin/inventory/product-change-logs?limit=40', { cache: 'no-store' }),
        fetch('/api/admin/inventory/import-review?status=pending&limit=100', { cache: 'no-store' })
      ]);
      const logsPayload = (await logsResponse.json()) as ProductChangeLogsPayload;
      const reviewPayload = (await reviewResponse.json()) as ImportReviewPayload;
      if (logsResponse.ok && logsPayload.ok && Array.isArray(logsPayload.items)) {
        setProductChangeLogs(logsPayload.items);
      }
      if (reviewResponse.ok && reviewPayload.ok && Array.isArray(reviewPayload.items)) {
        setImportReviewItems(reviewPayload.items);
      }

      setImportSummary(completedJob.summary);
      setLatestImportLog(completedJob.importLog ?? null);
      setImportLogWarning(String(completedJob.logWarning ?? '').trim());
      setImportFile(null);
      setImportProgress({
        phase: 'completed',
        percent: 100,
        message: 'Імпорт завершено.'
      });
      setActiveImportJobId('');
      setSuccess(completedJob.logWarning ? 'Імпорт товарів завершено, але лог файлу не вдалося зберегти.' : 'Імпорт товарів завершено.');
    } catch (e) {
      setActiveImportJobId('');
      setImportProgress(initialImportProgress);
      setError(e instanceof Error ? e.message : 'Не вдалося імпортувати товари з Excel.');
    } finally {
      setIsImportingProducts(false);
    }
  }

  async function handleResolveImportReview(itemId: number) {
    setResolvingImportReviewId(itemId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/inventory/import-review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, status: 'resolved' })
      });
      const payload = (await response.json()) as ImportReviewPayload;
      if (!response.ok || !payload.ok || !Array.isArray(payload.items)) {
        throw new Error(payload.error || 'Не вдалося оновити статус перевірки товару.');
      }
      setImportReviewItems(payload.items);
      setSuccess('Позицію позначено як перевірену.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося оновити статус перевірки товару.');
    } finally {
      setResolvingImportReviewId(null);
    }
  }

  async function handleProductSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductPage(1);
    await loadProducts({ page: 1 });
  }

  useEffect(() => {
    function syncFromHash() {
      const hash = window.location.hash.replace(/^#/, '') as InventorySubsectionId | '';
      if (!hash) {
        setActiveSection(inventorySubsectionToSection[initialSubsection]);
        setActiveSubsection(initialSubsection);
        return;
      }
      if (!(hash in inventorySubsectionToSection)) return;

      const nextSection = inventorySubsectionToSection[hash];
      setActiveSection(nextSection);
      setActiveSubsection(hash);
    }

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [initialSubsection]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Інвентар</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Інвентар і Telegram workflow</h1>
          <p className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Таблиць готово: {existingTablesCount}/{readiness?.tables.length ?? 0}
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          Тут зібрані БД, web-адмінка і Telegram. Окремо ведеться реєстрація працівників, товари, партії і відповідальні по магазинах.
        </p>
      </div>

      {activeSection === 'overview' ? (
        <section id="overview" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Огляд</h2>
              <p className="mt-1 text-sm text-slate-600">
                Швидкий стан inventory: довідник, партії, контроль термінів і готовність схеми.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Остання перевірка схеми</p>
              <p className="mt-1">{formatDate(readiness?.checkedAt ?? '')}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Товари</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{overviewMetrics.totalProducts}</p>
              <p className="mt-1 text-sm text-slate-600">У довіднику та ручних додаваннях.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Партії</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{overviewMetrics.totalBatches}</p>
              <p className="mt-1 text-sm text-slate-600">Усі активні записи по складах і магазинах.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Кількість</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{overviewMetrics.totalQuantity}</p>
              <p className="mt-1 text-sm text-slate-600">Загальна кількість одиниць по всіх партіях.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Магазини</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{overviewMetrics.totalStores}</p>
              <p className="mt-1 text-sm text-slate-600">Магазини, де вже є inventory-дані.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Працівники</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{overviewMetrics.totalUsers}</p>
              <p className="mt-1 text-sm text-slate-600">Активні прив’язані користувачі.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Закінчується</p>
              <p className="mt-2 text-3xl font-bold text-amber-700">{overviewMetrics.expiringSoonCount}</p>
              <p className="mt-1 text-sm text-slate-600">Партії в межах власного порогу сповіщення.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Прострочено</p>
              <p className="mt-2 text-3xl font-bold text-red-700">{overviewMetrics.overdueCount}</p>
              <p className="mt-1 text-sm text-slate-600">Партії, у яких термін уже минув.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Потрібують дії</p>
              <p className="mt-2 text-3xl font-bold text-brand">{overviewMetrics.needsActionCount}</p>
              <p className="mt-1 text-sm text-slate-600">Партії без реакції або на межі нагадування.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Критичні партії</h3>
                  <p className="mt-1 text-sm text-slate-600">Найближчі до сповіщення, прострочені або без призначеного відповідального.</p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {overviewMetrics.criticalBatches.length}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {overviewMetrics.criticalBatches.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
                    Поки немає партій, які потребують уваги.
                  </p>
                ) : (
                  overviewMetrics.criticalBatches.map(({ batch, daysLeft, isOverdue, isExpiringSoon, needsAction, isUnassigned }) => (
                    <div key={batch.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{batch.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {batch.storeLabel} • партія #{batch.id} • термін {batch.expiryDate}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            isOverdue
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : isExpiringSoon
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                        >
                          {isOverdue ? `Прострочено ${Math.abs(daysLeft)} дн.` : `Залишилось ${daysLeft} дн.`}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {needsAction ? (
                          <span className="rounded-full border border-brand/20 bg-brand/5 px-2.5 py-1 font-semibold text-brand">
                            Потребує дії
                          </span>
                        ) : null}
                        {isUnassigned ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
                            Без відповідального
                          </span>
                        ) : null}
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
                          Статус: {batch.checkStatus || 'new'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">Стан схеми</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    Готово таблиць: <span className="font-semibold text-slate-900">{existingTablesCount}/{readiness?.tables.length ?? 0}</span>
                  </p>
                  <p>
                    Відсутні таблиці: <span className="font-semibold text-slate-900">{missingTables.length === 0 ? 'немає' : missingTables.join(', ')}</span>
                  </p>
                  <p>
                    Колонки `product_batches`: <span className="font-semibold text-slate-900">{missingProductBatchColumns.length === 0 ? 'усі є' : missingProductBatchColumns.join(', ')}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">Оперативні показники</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    Партій без відповідального: <span className="font-semibold text-slate-900">{overviewMetrics.unassignedCount}</span>
                  </p>
                  <p>
                    Ручні товари: <span className="font-semibold text-slate-900">{overviewMetrics.manualProductsCount}</span>
                  </p>
                  <p>
                    Очікують імпорт-розбору: <span className="font-semibold text-slate-900">{overviewMetrics.pendingImportCount}</span>
                  </p>
                </div>
                {overviewMetrics.hasSchemaIssues ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                    Є недоліки в схемі або `product_batches`.
                  </p>
                ) : (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    Схема inventory-модуля виглядає готовою.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="space-y-5">

      {activeSection === 'schema' ? (
      <section id="settings-schema" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Готовність схеми</h2>
            <p className="mt-1 text-sm text-slate-600">
              Остання перевірка: <span className="font-semibold">{formatDate(readiness?.checkedAt ?? '')}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleApplyMigrations();
            }}
            disabled={isApplying || isLoading}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:opacity-60"
          >
            {isApplying ? 'Застосування...' : 'Застосувати inventory-міграції'}
          </button>
        </div>

        {isLoading ? <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Перевірка таблиць inventory-модуля...</p> : null}
        {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {success ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}
        {isApplied ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Readiness-стан оновлено після застосування міграцій.</p> : null}

        {readiness ? (
            <div className="mt-4 space-y-4">
            <div className="grid gap-3 lg:grid-cols-2">
              {readiness.tables.map((item) => (
                <div
                  key={item.name}
                  className={`rounded-xl border px-3 py-3 text-sm ${item.exists ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
                >
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1">{item.exists ? 'Таблиця присутня в БД.' : 'Таблиця поки відсутня в БД.'}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-900">Перевірка `product_batches`</p>
              <p className="mt-2 text-slate-700">
                {!readiness.productBatches.checked
                  ? 'Таблиця ще не існує.'
                  : missingProductBatchColumns.length === 0
                    ? 'Ключові колонки для workflow і відповідальних присутні.'
                    : `Відсутні колонки: ${missingProductBatchColumns.join(', ')}.`}
              </p>
            </div>

            {missingTables.length > 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                Треба створити таблиці: {missingTables.join(', ')}.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
      ) : null}

      {activeSection === 'product-list' ? (
      <section id="product-list" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Список товарів</h2>
            <p className="mt-1 text-sm text-slate-600">Основний довідник товарів inventory-модуля та товари, які були створені працівниками вручну.</p>
          </div>
          <p className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Товарів: {productsTotalCount}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Довідник товарів</h3>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Сторінка {productPage} з {productTotalPages}
            </span>
          </div>

          <form onSubmit={handleProductSearchSubmit} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_160px_auto]">
            <input
              value={productSearchQuery}
              onChange={(event) => setProductSearchQuery(event.target.value)}
              placeholder="Пошук по назві, артикулу, штрихкоду"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
            <select
              value={productCategoryFilter}
              onChange={(event) => {
                setProductCategoryFilter(event.target.value);
                setProductPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              <option value="">Усі категорії</option>
              {productCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={productPageSize}
              onChange={(event) => {
                setProductPageSize(Number(event.target.value || 50));
                setProductPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  По {size}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
              Знайти
            </button>
          </form>

          {isLoadingProducts ? (
            <p className="mt-3 text-sm text-slate-600">Завантаження товарів...</p>
          ) : products.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">За цими фільтрами товари не знайдено.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {products.map((product) => (
                <div key={product.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{product.productName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Артикул: {product.article || '—'} • ШК: {formatProductBarcodes(product.barcodes, product.barcode)} • {product.category || 'Без категорії'}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      {product.isActive ? 'active' : 'inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">
              Показано {products.length} з {productsTotalCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProductPage((prev) => Math.max(prev - 1, 1))}
                disabled={productPage <= 1 || isLoadingProducts}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Назад
              </button>
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                {productPage}/{productTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setProductPage((prev) => Math.min(prev + 1, productTotalPages))}
                disabled={productPage >= productTotalPages || isLoadingProducts}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Далі
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Товари, створені працівниками</h3>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {manualProductCreations.length}
            </span>
          </div>
          {manualProductCreations.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Працівники ще не створювали нові товари вручну.</p>
          ) : (
          <div className="mt-4 space-y-3">
            {manualProductCreations.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.productName || 'Товар без назви'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Артикул: {item.article || '—'} • ШК: {item.barcode || '—'} • Дата: {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <p className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    #{item.productId ?? item.id}
                  </p>
                </div>
                <p className="mt-3 text-sm text-slate-700">
                  Додав: {[item.userSurname, item.userName].filter(Boolean).join(' ').trim() || 'Невідомий користувач'}
                </p>
                <p className="mt-1 text-sm text-slate-600">Магазин: {item.storeLabel || 'Не вказано'}</p>
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-slate-800 whitespace-pre-wrap">
                  {item.comment || 'Примітка відсутня.'}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Останні зміни товарів</h3>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {productChangeLogs.length}
            </span>
          </div>
          {productChangeLogs.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Поки немає зафіксованих змін у довіднику товарів.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {productChangeLogs.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.productName || 'Товар без назви'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatProductChangeField(item.fieldName)} • Артикул: {item.article || '—'} • ШК: {item.barcode || '—'}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{item.oldValue || '—'}</span>
                    {' -> '}
                    <span className="font-semibold text-slate-900">{item.newValue || '—'}</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Джерело: {item.changeSource} {item.changedBy ? `• ${item.changedBy}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      ) : null}

      {activeSection === 'batches' ? (
      <section id="batches-list" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{batchViewMeta.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{batchViewMeta.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Партій: {selectedStoreBatchGroups.length}
            </span>
            <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)} className="min-w-[260px] rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand">
              <option value="">Усі магазини</option>
              {stores.filter((store) => store.isActive).map((store) => (
                <option key={store.id} value={store.id}>{storeLabel(store)}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedStoreBatches.length === 0 ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Для вибраного магазину ще немає партій у поточному списку.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {selectedStoreBatchGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                onClick={() => {
                  setSelectedBatchGroupKey(group.key);
                  setSelectedBatchModalUserKey('');
                }}
                className="block w-full px-4 py-3 text-left transition hover:bg-brand/5 focus:bg-brand/5 focus:outline-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{group.storeLabel || 'Магазин не вказано'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      Позицій: {group.count}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      Кількість: {group.totalQuantity}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
      ) : null}

      {activeSection === 'import' ? (
      <section id="product-import" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Імпорт товарів з Excel</h2>
            <p className="mt-1 text-sm text-slate-600">Завантажте файл `.xlsx` з колонками `Номенклатура`, `Одиниці вимірювання`, `Штрихкод`, `Артикул`.</p>
          </div>
          <p className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Поточний довідник: {productsTotalCount}
          </p>
        </div>

        <form onSubmit={handleImportProducts} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:font-semibold file:text-white"
            />
            <button
              type="submit"
              disabled={isImportingProducts || !importFile}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isImportingProducts ? 'Імпорт...' : 'Запустити імпорт'}
            </button>
          </div>

          {isImportingProducts || importProgress.phase === 'completed' ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="font-semibold text-slate-900">Прогрес імпорту</p>
                <span className="font-semibold text-slate-700">{importProgress.percent}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getImportProgressBarClassName(importProgress.phase)}`}
                  style={{ width: `${Math.max(importProgress.percent, 0)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {importProgress.message || 'Очікуємо запуск імпорту.'}
              </p>
            </div>
          ) : null}

          {importSummary ? (
            <div className="mt-4 space-y-4">
              {latestImportLog ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Останній збережений лог імпорту</p>
                  <p className="mt-2">
                    Файл: <span className="font-medium text-slate-900">{latestImportLog.fileName}</span>
                  </p>
                  <p className="mt-1">
                    Імпортував: <span className="font-medium text-slate-900">{latestImportLog.importedBy || 'admin'}</span>
                  </p>
                  <p className="mt-1">
                    Дата: <span className="font-medium text-slate-900">{formatDate(latestImportLog.storedAt)}</span>
                  </p>
                  <p className="mt-1">
                    JSON-лог:{' '}
                    <a href={latestImportLog.logFileUrl} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                      {latestImportLog.logFileName}
                    </a>
                  </p>
                </div>
              ) : null}

              {importLogWarning ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Лог файлу не збережено</p>
                  <p className="mt-2">{importLogWarning}</p>
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Рядків</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{importSummary.total}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Нові товари</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{importSummary.productsCreated}</p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Оновлені товари</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{importSummary.productsUpdated}</p>
                </div>
                <div className="rounded-xl border border-brand/20 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Додано баркодів</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{importSummary.barcodeEntriesAdded}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Без змін</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{importSummary.skipped}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Перевірити</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{importSummary.needsReview}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p>
                  Оброблено рядків: {importSummary.total}. Знайдено існуючих товарів: {importSummary.productsMatchedExisting}. Збережено вже існуючих баркодів без змін: {importSummary.barcodeEntriesKept}. Невалідних рядків: {importSummary.invalidRows}.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Лог останнього імпорту</p>
                    <p className="mt-1 text-xs text-slate-500">Показує, що сталося з кожним рядком файлу.</p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {importSummary.log.length}
                  </span>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Рядок</th>
                        <th className="px-4 py-3">Статус</th>
                        <th className="px-4 py-3">Товар</th>
                        <th className="px-4 py-3">Артикул</th>
                        <th className="px-4 py-3">Штрихкод</th>
                        <th className="px-4 py-3">Од. виміру</th>
                        <th className="px-4 py-3">Коментар</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {importSummary.log.map((item) => (
                        <tr key={`${item.rowNumber}-${item.article}-${item.barcode}`}>
                          <td className="px-4 py-3 align-top text-slate-700">{item.rowNumber}</td>
                          <td className="px-4 py-3 align-top">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getImportStatusClassName(item.status)}`}>
                              {getImportStatusLabel(item.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top font-medium text-slate-900">{item.productName || '—'}</td>
                          <td className="px-4 py-3 align-top text-slate-700">{item.article || '—'}</td>
                          <td className="px-4 py-3 align-top text-slate-700">{item.barcode || '—'}</td>
                          <td className="px-4 py-3 align-top text-slate-700">{item.unitsOfMeasurement || '—'}</td>
                          <td className="px-4 py-3 align-top text-slate-600">{item.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </form>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Потребують перевірки</h3>
              <p className="mt-1 text-sm text-slate-600">Сюди потрапляють рядки, де товар знайшовся, але баркод уже привʼязаний до іншого товару або дані потребують ручної перевірки.</p>
            </div>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {importReviewItems.length}
            </span>
          </div>

          {importReviewItems.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Наразі немає товарів, які потребують ручної перевірки після імпорту.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {importReviewItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.productName || 'Товар без назви'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Артикул: {item.article || '—'} • статус: {item.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleResolveImportReview(item.id);
                      }}
                      disabled={resolvingImportReviewId === item.id}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      {resolvingImportReviewId === item.id ? 'Збереження...' : 'Позначити перевіреним'}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Поточний штрихкод</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{item.existingBarcode || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Імпортований штрихкод</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{item.incomingBarcode || '—'}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {item.note || 'Конфлікт потребує перевірки.'} • {formatDate(item.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      ) : null}

      {activeSection === 'intake' ? (
      <section id="product-create" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Додати товар і партію</h2>
            <p className="mt-1 text-sm text-slate-600">Одна форма створює товар і одразу першу партію по ньому.</p>
          </div>
          <p className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Товарів: {productsTotalCount} • Партій: {batches.length}
          </p>
        </div>

        <form onSubmit={handleCreateIntake} className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-900">Дані товару</h3>
            <input value={String(productForm.article ?? '')} onChange={(e) => setProductForm((prev) => ({ ...prev, article: e.target.value }))} placeholder="Артикул *" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            <input value={String(productForm.barcode ?? '')} onChange={(e) => setProductForm((prev) => ({ ...prev, barcode: e.target.value }))} placeholder="Штрихкоди через кому" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            <input value={String(productForm.productName ?? '')} onChange={(e) => setProductForm((prev) => ({ ...prev, productName: e.target.value }))} placeholder="Назва товару *" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            <div className="grid gap-3 md:grid-cols-2">
              <input value={String(productForm.unitsOfMeasurement ?? '')} onChange={(e) => setProductForm((prev) => ({ ...prev, unitsOfMeasurement: e.target.value }))} placeholder="Одиниця виміру *" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
              <input value={String(productForm.category ?? '')} onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Категорія" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input type="number" min={1} max={90} value={Number(productForm.notifiedDaysDefault ?? 7)} onChange={(e) => setProductForm((prev) => ({ ...prev, notifiedDaysDefault: Number(e.target.value || 7) }))} placeholder="Днів до сповіщення" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
              <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800">
                <input type="checkbox" checked={productForm.isActive !== false} onChange={(e) => setProductForm((prev) => ({ ...prev, isActive: e.target.checked }))} className="h-4 w-4" />
                Активний товар
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-900">Перша партія</h3>
            <select value={String(batchForm.storeId ?? '')} onChange={(e) => setBatchForm((prev) => ({ ...prev, storeId: e.target.value }))} className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand">
              <option value="">Оберіть магазин *</option>
              {stores.filter((store) => store.isActive).map((store) => (
                <option key={store.id} value={store.id}>{storeLabel(store)}</option>
              ))}
            </select>
            <input
              value={String(batchForm.batchCode ?? '')}
              onChange={(e) => setBatchForm((prev) => ({ ...prev, batchCode: e.target.value }))}
              placeholder="Код партії поставки"
              className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input type="number" min={1} value={Number(batchForm.quantity ?? 1)} onChange={(e) => setBatchForm((prev) => ({ ...prev, quantity: Number(e.target.value || 0) }))} placeholder="Кількість *" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
              <input type="number" min={1} max={90} value={batchNotifyOverride} onChange={(e) => setBatchNotifyOverride(e.target.value)} placeholder="Окремі дні до сповіщення" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input type="date" value={String(batchForm.expiryDate ?? '')} onChange={(e) => setBatchForm((prev) => ({ ...prev, expiryDate: e.target.value }))} className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
              <input type="date" value={String(batchForm.deliveryDate ?? '')} onChange={(e) => setBatchForm((prev) => ({ ...prev, deliveryDate: e.target.value }))} className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={isCreatingIntake} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {isCreatingIntake ? 'Збереження...' : 'Додати товар і партію'}
              </button>
            </div>
          </div>
        </form>
      </section>
      ) : null}

      {activeSection === 'operations' ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {activeSubsection === 'employee-tasks' ? 'Завдання працівника' : 'Працівники та відповідальні по магазину'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {activeSubsection === 'employee-tasks'
                ? 'Тут видно активні та архівні задачі по вибраному працівнику з expiry-контролю.'
                : 'Можна перевірити, хто зареєстрований на магазин, і перенаправити партію на іншого працівника.'}
            </p>
          </div>
          <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)} className="min-w-[260px] rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand">
            <option value="">Усі магазини</option>
            {stores.filter((store) => store.isActive).map((store) => (
              <option key={store.id} value={store.id}>{storeLabel(store)}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.48fr)_minmax(0,1fr)]">
          <div id="registered-employees" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Зареєстровані працівники</h3>
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{selectedStoreUsers.length}</span>
            </div>
            {selectedStoreUsers.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Для цього магазину ще немає зареєстрованих працівників.</p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {selectedStoreUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedInventoryUserId(user.id)}
                    className={`block w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      selectedInventoryUser?.id === user.id
                        ? 'border-brand bg-brand/5'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{user.surname} {user.name}</p>
                      <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700">{user.role}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{user.positionTitle || 'Посаду ще не вказано'}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{user.storeLabel || 'Магазин не прив’язано'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeSubsection === 'employee-tasks' ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {!selectedInventoryUser ? (
              <p className="text-sm text-slate-600">Оберіть працівника ліворуч, щоб переглянути його задачі.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {selectedInventoryUser.surname} {selectedInventoryUser.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedInventoryUser.positionTitle || 'Посаду ще не вказано'} • {formatInventoryUserRole(selectedInventoryUser.role)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{selectedInventoryUser.storeLabel || 'Магазин не прив’язано'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                        Активні: {selectedInventoryUserTaskSummary.totalActive}
                      </span>
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                        Архів: {selectedInventoryUserTaskSummary.totalArchived}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Активні задачі</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-900">{selectedInventoryUserTaskSummary.totalActive}</p>
                      <p className="mt-1 text-xs text-slate-500">У роботі прямо зараз.</p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Прострочені</p>
                      <p className="mt-2 text-3xl font-semibold text-rose-900">{selectedInventoryUserTaskSummary.overdueActiveTasks}</p>
                      <p className="mt-1 text-xs text-rose-700">Потрібна швидка реакція.</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Ескалації</p>
                      <p className="mt-2 text-3xl font-semibold text-amber-900">{selectedInventoryUserTaskSummary.escalatedActiveTasks}</p>
                      <p className="mt-1 text-xs text-amber-700">Для обговорення або рішення.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Архівні</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-900">{selectedInventoryUserTaskSummary.totalArchived}</p>
                      <p className="mt-1 text-xs text-slate-500">Завершені або скасовані.</p>
                    </div>
                  </div>
                </div>

                {isLoadingInventoryTasks ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    Завантажуємо задачі працівника...
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">Активні задачі</h3>
                          <p className="mt-1 text-xs text-slate-500">Відкриті, ескальовані та задачі на списання.</p>
                        </div>
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          {inventoryActiveTasks.length}
                        </span>
                      </div>

                      {inventoryActiveTasks.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-600">Для цього працівника немає активних задач.</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {inventoryActiveTasks.map((task) => (
                            <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{task.productName}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Партія #{task.batchId} • код: {task.batchCode || '—'} • арт.: {task.article || '—'}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getExpiryTaskStatusClassName(task.status)}`}>
                                    {formatExpiryTaskStatus(task.status)}
                                  </span>
                                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getExpiryTaskRiskClassName(task.riskLevel)}`}>
                                    {formatExpiryTaskRiskLevel(task.riskLevel)}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Термін: {task.dueDate || '—'}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{formatDaysLeftLabel(task.daysLeftSnapshot)}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Магазин: {task.storeLabel || '—'}</span>
                              </div>

                              <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                <p>Штрихкоди: <span className="font-semibold text-slate-900">{task.barcode || '—'}</span></p>
                                <p>Вперше виявлено: <span className="font-semibold text-slate-900">{formatDate(task.firstDetectedAt)}</span></p>
                                <p>Останнє сповіщення: <span className="font-semibold text-slate-900">{task.lastNotifiedAt ? formatDate(task.lastNotifiedAt) : 'ще не надсилалось'}</span></p>
                              </div>

                              {task.note ? <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700">{task.note}</p> : null}
                            </article>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">Архів задач</h3>
                          <p className="mt-1 text-xs text-slate-500">Завершені та скасовані задачі по цьому працівнику.</p>
                        </div>
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          {inventoryArchivedTasks.length}
                        </span>
                      </div>

                      {inventoryArchivedTasks.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-600">Архівних задач для цього працівника поки немає.</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {inventoryArchivedTasks.map((task) => (
                            <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{task.productName}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Партія #{task.batchId} • код: {task.batchCode || '—'} • арт.: {task.article || '—'}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getExpiryTaskStatusClassName(task.status)}`}>
                                    {formatExpiryTaskStatus(task.status)}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Термін: {task.dueDate || '—'}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Ризик: {formatExpiryTaskRiskLevel(task.riskLevel)}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Магазин: {task.storeLabel || '—'}</span>
                              </div>

                              <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                <p>Завершено: <span className="font-semibold text-slate-900">{task.completedAt ? formatDate(task.completedAt) : '—'}</span></p>
                                <p>Оновлено: <span className="font-semibold text-slate-900">{formatDate(task.updatedAt)}</span></p>
                              </div>

                              {task.note ? <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700">{task.note}</p> : null}
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          ) : (
          <div id="registered-employees" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900">Картка працівника</h3>
                {selectedInventoryUser ? (
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    ID {selectedInventoryUser.id}
                  </span>
                ) : null}
              </div>
              {!selectedInventoryUser ? (
                <p className="mt-3 text-sm text-slate-600">Оберіть працівника ліворуч, щоб побачити деталі.</p>
              ) : (
                <div className="mt-3 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-semibold">{selectedInventoryUser.surname} {selectedInventoryUser.name}</p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedInventoryUser.positionTitle || 'Посаду ще не вказано'} • {formatInventoryUserRole(selectedInventoryUser.role)}
                        </p>
                        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-300">Магазин</p>
                        <p className="mt-1 text-sm text-white">{selectedInventoryUser.storeLabel || 'Магазин не прив’язано'}</p>
                      </div>

                      <div className="min-w-[220px] space-y-2 rounded-2xl border border-white/15 bg-white/10 p-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-300">Статус</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedInventoryUser.isActive ? 'bg-emerald-400/15 text-emerald-100' : 'bg-slate-400/15 text-slate-100'}`}>
                            {selectedInventoryUser.isActive ? 'Активний' : 'Неактивний'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-300">chat_id</span>
                          <span className="font-medium text-white">{selectedInventoryUser.userChatId || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-300">Виконання задач</span>
                          <span className="font-semibold text-white">{selectedInventoryUserStats?.completionRatio ?? 0}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedInventoryUserStats ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Додані товари</p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">{selectedInventoryUserStats.createdProductsCount}</p>
                        <p className="mt-1 text-xs text-slate-500">Ручні створення за весь поточний список</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Створені партії</p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">{selectedInventoryUserStats.createdBatchesCount}</p>
                        <p className="mt-1 text-xs text-slate-500">Кількість: {selectedInventoryUserStats.totalCreatedQuantity}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Задачі в роботі</p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">{selectedInventoryUserStats.responsibleBatchesCount}</p>
                        <p className="mt-1 text-xs text-slate-500">Відповідає за кількість: {selectedInventoryUserStats.totalResponsibleQuantity}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Продуктивність</p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">{selectedInventoryUserStats.completionRatio}%</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Завершено: {selectedInventoryUserStats.completedResponsibleCount} з {selectedInventoryUserStats.attentionRequiredCount} позицій, що потребували уваги
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {selectedInventoryUserStats ? (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-slate-900">Активність працівника</p>
                            <p className="mt-1 text-xs text-slate-500">За останні 7 днів: ручні товари та створені партії.</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">Товари: {selectedInventoryUserStats.createdProductsCount}</span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">Партії: {selectedInventoryUserStats.createdBatchesCount}</span>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-7 gap-3">
                          {selectedInventoryUserStats.activityTrend.map((item) => {
                            const manualHeight = Math.max(10, Math.round((item.manualProducts / selectedInventoryUserStats.maxTrendValue) * 92));
                            const batchHeight = Math.max(10, Math.round((item.batchesCreated / selectedInventoryUserStats.maxTrendValue) * 92));

                            return (
                              <div key={item.dayKey} className="flex flex-col items-center gap-2">
                                <div className="flex h-28 items-end gap-1">
                                  <div className="w-4 rounded-t-full bg-brand/85" style={{ height: `${manualHeight}px` }} title={`Товари: ${item.manualProducts}`} />
                                  <div className="w-4 rounded-t-full bg-sky-500" style={{ height: `${batchHeight}px` }} title={`Партії: ${item.batchesCreated}`} />
                                </div>
                                <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand" /> Ручні товари</span>
                          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Створені партії</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-slate-900">Статус задач</p>
                            <p className="mt-1 text-xs text-slate-500">Поточне навантаження і критичні задачі працівника.</p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            {selectedInventoryUserStats.responsibleBatchesCount} задач
                          </span>
                        </div>

                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                          <div className="flex h-full w-full">
                            {selectedInventoryUserStats.workloadSegments.map((segment) => (
                              <div
                                key={segment.label}
                                className={segment.className}
                                style={{
                                  width: `${selectedInventoryUserStats.responsibleBatchesCount > 0
                                    ? (segment.value / selectedInventoryUserStats.responsibleBatchesCount) * 100
                                    : 0}%`
                                }}
                                title={`${segment.label}: ${segment.value}`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {selectedInventoryUserStats.workloadSegments.map((segment) => (
                            <div key={segment.label}>
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <p className="font-medium text-slate-800">{segment.label}</p>
                                <p className="text-slate-500">{segment.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Прострочені</p>
                            <p className="mt-2 text-2xl font-semibold text-rose-900">{selectedInventoryUserStats.overdueResponsibleCount}</p>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Потрібна увага</p>
                            <p className="mt-2 text-2xl font-semibold text-amber-900">
                              {selectedInventoryUserStats.expiringResponsibleCount + selectedInventoryUserStats.discussionResponsibleCount}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Магазин</p>
                        <select
                          value={String(selectedInventoryUser.storeId ?? '')}
                          onChange={(e) =>
                            setInventoryUsers((prev) =>
                              prev.map((item) =>
                                item.id === selectedInventoryUser.id
                                  ? {
                                      ...item,
                                      storeId: e.target.value ? Number(e.target.value) : null,
                                      storeLabel: stores.find((store) => store.id === e.target.value)
                                        ? storeLabel(stores.find((store) => store.id === e.target.value) as StoreRecord)
                                        : ''
                                    }
                                  : item
                              )
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-brand"
                        >
                          <option value="">Магазин не прив’язано</option>
                          {stores.filter((store) => store.isActive).map((store) => (
                            <option key={store.id} value={store.id}>
                              {storeLabel(store)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Посада</p>
                        <input
                          value={selectedInventoryUser.positionTitle}
                          onChange={(e) =>
                            setInventoryUsers((prev) =>
                              prev.map((item) =>
                                item.id === selectedInventoryUser.id ? { ...item, positionTitle: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Посада"
                          className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-brand"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Роль користувача</p>
                      <select
                        value={selectedInventoryUser.role}
                        onChange={(e) =>
                          setInventoryUsers((prev) =>
                            prev.map((item) =>
                              item.id === selectedInventoryUser.id
                                ? { ...item, role: e.target.value as InventoryUserView['role'] }
                                : item
                            )
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-brand"
                      >
                        <option value="staff">staff</option>
                        <option value="manager">manager</option>
                        <option value="store_manager">store_manager</option>
                        <option value="admin">admin</option>
                      </select>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Активність</p>
                        <label className="flex h-[42px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800">
                          <input
                            type="checkbox"
                            checked={selectedInventoryUser.isActive}
                            onChange={(e) =>
                              setInventoryUsers((prev) =>
                                prev.map((item) =>
                                  item.id === selectedInventoryUser.id ? { ...item, isActive: e.target.checked } : item
                                )
                              )
                            }
                            className="h-4 w-4"
                          />
                          Активний працівник
                        </label>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          void handleSaveInventoryUser(selectedInventoryUser);
                        }}
                        disabled={savingInventoryUserId === selectedInventoryUser.id}
                        className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {savingInventoryUserId === selectedInventoryUser.id ? 'Збереження...' : 'Зберегти зміни'}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Останні дії працівника</p>
                      <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {selectedInventoryUserRecentActions.length}
                      </span>
                    </div>
                    {selectedInventoryUserRecentActions.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-600">Поки що немає зафіксованих дій у доступних даних.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {selectedInventoryUserRecentActions.map((item) => (
                          <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.type === 'manual-product' ? 'border border-brand/20 bg-brand/10 text-brand' : 'border border-sky-200 bg-sky-50 text-sky-700'}`}>
                                {item.type === 'manual-product' ? 'Новий товар' : 'Нова партія'}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                            {item.note ? <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{item.note}</p> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Поточні задачі працівника</p>
                      <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {selectedInventoryUserTaskList.length}
                      </span>
                    </div>
                    {selectedInventoryUserTaskList.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-600">Немає партій, закріплених за працівником, у поточному списку.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {selectedInventoryUserTaskList.slice(0, 8).map((batch) => (
                          <div key={batch.id} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{batch.productName}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Код поставки: {batch.batchCode || '—'} • партія #{batch.id} • кількість: {batch.quantity}
                                </p>
                              </div>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${batch.urgencyClassName}`}>
                                {batch.urgencyLabel}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Термін: {batch.expiryDate || '—'}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Статус: {formatBatchCheckStatus(batch.checkStatus || 'new')}</span>
                              {batch.actionTaken ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Дія: {batch.actionTaken}</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Товари, які додав працівник</p>
                      <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {selectedInventoryUserCreatedProducts.length}
                      </span>
                    </div>
                    {selectedInventoryUserCreatedProducts.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-600">Немає ручних товарів у поточному списку.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {selectedInventoryUserCreatedProducts.map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                            <p className="text-sm font-semibold text-slate-900">{item.productName || 'Товар без назви'}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Артикул: {item.article || '—'} • ШК: {item.barcode || '—'} • {formatDate(item.createdAt)}
                            </p>
                            {item.comment ? <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{item.comment}</p> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div id="batch-responsibility" className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Партії та відповідальні</h3>
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{selectedInventoryUserBatchGroups.length}</span>
            </div>
            {selectedInventoryUserResponsibleBatches.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Для вибраного працівника немає партій, де він призначений відповідальним.</p>
            ) : (
              <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {selectedInventoryUserBatchGroups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => {
                      setSelectedBatchGroupKey(group.key);
                      setSelectedBatchModalUserKey('');
                    }}
                    className="block w-full px-3 py-3 text-left transition hover:bg-brand/5 focus:bg-brand/5 focus:outline-none"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Поставка: {group.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {group.storeLabel} • позицій: {group.count} • загальна кількість: {group.totalQuantity}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        Відкрити
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
          )}
        </div>
      </section>
      ) : null}

      {activeSection === 'analytics' ? (
      <section id="analytics" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Inventory / Analytics</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Аналітика по партіях, ризиках і роботі працівників</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Тут зібрана операційна аналітика по залишках, критичних товарах, магазинах з найбільшим навантаженням і
              працівниках, які відповідають за перевірку партій.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(220px,320px)_minmax(180px,240px)_minmax(180px,240px)_1fr]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900">Магазин для аналітики</span>
            <select
              value={analyticsStoreId}
              onChange={(e) => setAnalyticsStoreId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand"
            >
              <option value="">Усі магазини</option>
              {stores.map((store) => (
                <option key={store.id} value={String(store.id)}>
                  {storeLabel(store)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900">Період з</span>
            <input
              type="date"
              value={analyticsDateFrom}
              onChange={(e) => setAnalyticsDateFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900">Період до</span>
            <input
              type="date"
              value={analyticsDateTo}
              onChange={(e) => setAnalyticsDateTo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand"
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Пояснення фільтра</p>
            <p className="mt-2">
              Залишки, кількість партій і працівники рахуються по вибраному магазину загалом. Період впливає на блоки
              ризику, строків придатності і позиції, що потребують уваги. Критичність визначається відносно кінцевої дати періоду.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Залишок зараз</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{analyticsMetrics.stockCurrent}</p>
            <p className="mt-1 text-xs text-slate-500">Сума `quantity_current` по всіх партіях</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Отримано</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{analyticsMetrics.stockReceived}</p>
            <p className="mt-1 text-xs text-slate-500">Сума `quantity_received` по всіх партіях</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Розбіжність</p>
            <p className="mt-2 text-2xl font-bold text-brand">{analyticsMetrics.stockDelta}</p>
            <p className="mt-1 text-xs text-slate-500">Різниця між отриманим і поточним залишком</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Працівники магазину</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{analyticsMetrics.totalUsers}</p>
            <p className="mt-1 text-xs text-slate-500">Активні користувачі у вибраному контурі</p>
          </article>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Статуси перевірки партій</h3>
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                У періоді: {analyticsMetrics.periodBatches} • Усього: {analyticsMetrics.totalBatches}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Нові</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{analyticsMetrics.statusCards.new}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Перевірені</p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">{analyticsMetrics.statusCards.checked}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">На списанні</p>
                <p className="mt-2 text-2xl font-bold text-rose-700">{analyticsMetrics.statusCards.writeoff}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Для обговорення</p>
                <p className="mt-2 text-2xl font-bold text-amber-700">{analyticsMetrics.statusCards.discussion}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Критичність партій</h3>
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                За строком придатності
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Прострочені', value: analyticsMetrics.riskCards.overdue, color: 'bg-rose-500' },
                { label: 'Критичні', value: analyticsMetrics.riskCards.critical, color: 'bg-red-500' },
                { label: 'Високий ризик', value: analyticsMetrics.riskCards.high, color: 'bg-orange-500' },
                { label: 'Середній ризик', value: analyticsMetrics.riskCards.medium, color: 'bg-amber-500' },
                { label: 'У запасі', value: analyticsMetrics.riskCards.safe, color: 'bg-emerald-500' }
              ].map((item) => {
                const total = Math.max(analyticsMetrics.totalBatches, 1);
                const width = Math.max(4, Math.round((item.value / total) * 100));
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm text-slate-700">
                      <span>{item.label}</span>
                      <span className="font-semibold text-slate-900">{item.value}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Магазини з найбільшим навантаженням</h3>
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                Top {analyticsMetrics.storeRows.length}
              </span>
            </div>
            {analyticsMetrics.storeRows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Ще немає достатньо даних для аналітики по магазинах.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {analyticsMetrics.storeRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Партій: {row.batches} • залишок: {row.currentQuantity}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        Потребують уваги: {row.attention}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Прострочені: {row.overdue}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Закінчуються: {row.expiring}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Активний ризик: {row.attention}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Працівники по відповідальних партіях</h3>
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                Top {analyticsMetrics.employeeRows.length}
              </span>
            </div>
            {analyticsMetrics.employeeRows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Ще немає достатньо даних для аналітики по працівниках.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {analyticsMetrics.employeeRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.role} • {row.storeLabel || 'Магазин не вказано'}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        Продуктивність: {row.completionRatio}%
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Відповідальних партій: {row.responsibleCount}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Потребували уваги: {row.attention}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Завершено: {row.completed}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Прострочені: {row.overdue}</span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, row.completionRatio)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      ) : null}

      {selectedBatchGroup ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
        <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Партія постачання</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedBatchGroup.label}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedBatchGroup.storeLabel} • позицій: {selectedBatchGroup.count} • загальна кількість: {selectedBatchGroup.totalQuantity}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBatchGroupKey('');
                  setSelectedBatchModalUserKey('');
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Закрити
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Користувачі</p>
                <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {selectedBatchGroupUserRows.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {selectedBatchGroupUserRows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setSelectedBatchModalUserKey(row.key)}
                    className={`block w-full rounded-xl border p-3 text-left transition ${
                      activeBatchModalUserKey === row.key
                        ? 'border-brand bg-white shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.caption || 'Без посади'}</p>
                      </div>
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {row.count}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Товари вибраного користувача</p>
                  <p className="mt-1 text-xs text-slate-500">Показані тільки позиції, де цей користувач записаний як той, хто додав товар.</p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {selectedBatchModalBatches.length} позицій
                </span>
              </div>

              {selectedBatchModalBatches.length === 0 ? (
                <p className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                  Для цього користувача немає товарів у вибраній поставці.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectedBatchModalBatches.map((batch) => {
                    const availableUsers = inventoryUsers.filter((user) => String(user.storeId ?? '') === String(batch.storeId) && user.isActive);

                    return (
                      <article key={batch.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{batch.productName}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Партія #{batch.id} • код: {batch.batchCode || '—'} • статус: {batch.checkStatus || 'new'}
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            {batch.quantity} од.
                          </span>
                        </div>

                        <div className="mt-3 grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                          <p>Артикул: <span className="font-semibold text-slate-900">{batch.article || '—'}</span></p>
                          <p>ШК: <span className="font-semibold text-slate-900">{batch.barcode || '—'}</span></p>
                          <p>Термін: <span className="font-semibold text-slate-900">{batch.expiryDate || '—'}</span></p>
                          <p>Поставка: <span className="font-semibold text-slate-900">{batch.deliveryDate || '—'}</span></p>
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_260px] md:items-center">
                          <p className="text-xs text-slate-600">
                            Додав: <span className="font-semibold text-slate-900">{batch.createdByUserName || 'не визначено'}</span>
                          </p>
                          <select
                            value={batch.responsibleUserId}
                            onChange={(e) => { void handleAssignResponsible(batch.id, e.target.value); }}
                            disabled={assigningBatchId === batch.id}
                            className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs outline-none focus:border-brand disabled:opacity-60"
                          >
                            <option value="">Без відповідального</option>
                            {availableUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {[`${user.surname} ${user.name}`, user.positionTitle].filter(Boolean).join(' | ')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
      ) : null}

      {activeSection === 'telegram' ? (
      <section id={activeSubsection === 'notifications' ? 'inventory-notifications' : 'settings-telegram'} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        {activeSubsection === 'notifications' ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Журнал сповіщень</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Тут видно, які повідомлення були надіслані працівникам, кому саме, по якому магазину і чи відкривали їх.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { void handleRunNotifications(); }} disabled={isRunningNotifications} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">
                  {isRunningNotifications ? 'Запуск сповіщень...' : 'Запустити сповіщення'}
                </button>
                <button type="button" onClick={() => { void loadNotificationLogs(); }} disabled={isLoadingNotificationLogs} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {isLoadingNotificationLogs ? 'Оновлення...' : 'Оновити журнал'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <select value={notificationsStoreFilter} onChange={(e) => setNotificationsStoreFilter(e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand">
                <option value="">Усі магазини</option>
                {stores.filter((store) => store.isActive).map((store) => (
                  <option key={store.id} value={store.id}>{storeLabel(store)}</option>
                ))}
              </select>
              <input type="date" value={notificationsDateFrom} onChange={(e) => setNotificationsDateFrom(e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
              <input type="date" value={notificationsDateTo} onChange={(e) => setNotificationsDateTo(e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Автозапуск сповіщень</p>
              <p className="mt-1">
                Endpoint для cron: <span className="font-mono">POST /api/inventory/notifications/run</span> з header
                <span className="font-mono"> x-inventory-notify-secret</span>.
              </p>
            </div>

            {notificationsDebug.length > 0 ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Debug по останньому запуску</p>
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {notificationsDebug.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {notificationsDebug.map((item) => (
                    <div
                      key={`${item.userId ?? 'none'}-${item.taskIds.join('-') || 'empty'}`}
                      className={`rounded-xl border p-4 text-sm ${
                        item.skipped ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name || 'Немає отримувача'}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {item.role ? `${item.role} • ` : ''}
                            {item.chatId ? `chat_id: ${item.chatId} • ` : ''}
                            Магазини: {item.stores.length > 0 ? item.stores.join('; ') : '—'}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {item.skipped ? 'Пропущено' : `Надіслано: ${item.sentCount}`}
                        </span>
                      </div>
                      <p className="mt-3 text-slate-800">{item.reason}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Задач: {item.active} • Критичні: {item.critical} • Високий ризик: {item.high} • Прострочені: {item.overdue}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Повторні нагадування: {item.repeat} • ID задач: {item.taskIds.length > 0 ? item.taskIds.join(', ') : '—'}
                      </p>
                      {item.error ? <p className="mt-2 text-xs text-red-700">Помилка: {item.error}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[150px_1fr_1fr_150px_150px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>Надіслано</span>
                <span>Магазин / отримувач</span>
                <span>Товар / текст</span>
                <span>Статус</span>
                <span>Відкрито</span>
              </div>
              {notificationLogs.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-600">
                  {isLoadingNotificationLogs ? 'Завантаження журналу...' : 'За вибраними фільтрами сповіщень не знайдено.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {notificationLogs.map((log) => (
                    <div key={log.id} className="grid grid-cols-[150px_1fr_1fr_150px_150px] gap-3 px-4 py-4 text-sm text-slate-700">
                      <div>
                        <p className="font-semibold text-slate-900">{formatDate(log.sentAt)}</p>
                        <p className="mt-1 text-xs text-slate-500">#{log.id}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{log.storeLabel || '—'}</p>
                        <p className="mt-1 text-xs text-slate-500">{log.recipientName || 'Отримувача не визначено'}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{log.productName || 'Без прив’язки до товару'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatNotificationLogType(log.notificationType)}
                          {log.article ? ` • арт. ${log.article}` : ''}
                          {log.batchCode ? ` • партія ${log.batchCode}` : ''}
                        </p>
                        <p className="mt-2 line-clamp-3 text-xs text-slate-600">{log.messageText}</p>
                      </div>
                      <div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          log.status === 'opened'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-sky-200 bg-sky-50 text-sky-700'
                        }`}>
                          {formatNotificationLogStatus(log.status)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{log.openedAt ? formatDate(log.openedAt) : '—'}</p>
                        <p className="mt-1 text-xs text-slate-500">{log.openedByName || 'Ще не відкрито'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
        <form onSubmit={handleSaveTelegramSettings} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Telegram інтеграція</h2>
              <p className="mt-1 text-sm text-slate-600">Спочатку збережи дані, потім окремо зареєструй webhook у Telegram.</p>
            </div>
            <p className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">Webhook: {webhookUrl || 'не сформовано'}</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input type="checkbox" checked={telegramSettings.enabled} onChange={(e) => updateTelegramSetting('enabled', e.target.checked)} className="h-4 w-4" />
            Увімкнути Telegram integration для inventory-модуля
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={telegramSettings.publicBaseUrl} onChange={(e) => updateTelegramSetting('publicBaseUrl', e.target.value)} placeholder="Public base URL" className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            <input value={telegramSettings.webhookPath} onChange={(e) => updateTelegramSetting('webhookPath', e.target.value)} placeholder="Webhook path" className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={telegramSettings.botUsername} onChange={(e) => updateTelegramSetting('botUsername', e.target.value)} placeholder="Bot username" className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            <input type="password" value={telegramSettings.botToken} onChange={(e) => updateTelegramSetting('botToken', e.target.value)} placeholder="Bot token" className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input type="password" value={telegramSettings.webhookSecret} onChange={(e) => updateTelegramSetting('webhookSecret', e.target.value)} placeholder="Webhook secret" className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            <input type="number" min={1} max={90} value={telegramSettings.defaultNotifiedDays} onChange={(e) => updateTelegramSetting('defaultNotifiedDays', Number(e.target.value || 0))} placeholder="Default notified days" className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={telegramSettings.staffChatId} onChange={(e) => updateTelegramSetting('staffChatId', e.target.value)} placeholder="Staff chat id" className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
            <input value={telegramSettings.adminChatId} onChange={(e) => updateTelegramSetting('adminChatId', e.target.value)} placeholder="Admin chat id" className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Webhook статус</p>
            <p className="mt-1">Current URL: {webhookInfo?.url || 'не зареєстровано'}</p>
            <p className="mt-1">Pending updates: {Number(webhookInfo?.pending_update_count ?? 0)}</p>
            {webhookInfo?.last_error_message ? <p className="mt-1 text-red-700">Last error: {webhookInfo.last_error_message}</p> : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Сповіщення про термін придатності</p>
            <p className="mt-1">
              Endpoint для cron: <span className="font-mono">POST /api/inventory/notifications/run</span> з header
              <span className="font-mono"> x-inventory-notify-secret</span> = webhook secret.
            </p>
            <p className="mt-1">Кнопка нижче запускає перевірку вручну з адмінки.</p>
          </div>
          {notificationsDebug.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Debug по останньому запуску</p>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {notificationsDebug.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {notificationsDebug.map((item) => (
                  <div
                    key={`${item.userId ?? 'none'}-${item.taskIds.join('-') || 'empty'}`}
                    className={`rounded-xl border p-4 text-sm ${
                      item.skipped ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.name || 'Немає отримувача'}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {item.role ? `${item.role} • ` : ''}
                          {item.chatId ? `chat_id: ${item.chatId} • ` : ''}
                          Магазини: {item.stores.length > 0 ? item.stores.join('; ') : '—'}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {item.skipped ? 'Пропущено' : `Надіслано: ${item.sentCount}`}
                      </span>
                    </div>
                    <p className="mt-3 text-slate-800">{item.reason}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Задач: {item.active} • Критичні: {item.critical} • Високий ризик: {item.high} • Прострочені: {item.overdue}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Повторні нагадування: {item.repeat} • ID задач: {item.taskIds.length > 0 ? item.taskIds.join(', ') : '—'}
                    </p>
                    {item.error ? <p className="mt-2 text-xs text-red-700">Помилка: {item.error}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {isSettingsSaved ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Дані Telegram інтеграції збережено.</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { void handleRunNotifications(); }} disabled={isRunningNotifications} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">
              {isRunningNotifications ? 'Запуск сповіщень...' : 'Запустити сповіщення'}
            </button>
            <button type="button" onClick={() => { void handleRegisterWebhook(); }} disabled={isRegisteringWebhook} className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60">
              {isRegisteringWebhook ? 'Реєстрація webhook...' : 'Зареєструвати webhook'}
            </button>
            <button type="submit" disabled={isSavingSettings} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {isSavingSettings ? 'Збереження...' : 'Зберегти Telegram налаштування'}
            </button>
          </div>
        </form>
        )}
      </section>
      ) : null}
      {intakeDuplicateBatch ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Підтвердження</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Знайдено схожу партію</h3>
          <p className="mt-2 text-sm text-slate-600">
            У магазині вже є партія цього товару з таким самим терміном придатності. Обери, що зробити далі.
          </p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p><span className="font-semibold text-slate-900">Товар:</span> {intakeDuplicateBatch.productName}</p>
            <p className="mt-1"><span className="font-semibold text-slate-900">Магазин:</span> {intakeDuplicateBatch.storeLabel}</p>
            <p className="mt-1"><span className="font-semibold text-slate-900">Термін:</span> {intakeDuplicateBatch.expiryDate}</p>
            <p className="mt-1"><span className="font-semibold text-slate-900">Поточна кількість:</span> {intakeDuplicateBatch.quantity}</p>
            <p className="mt-1"><span className="font-semibold text-slate-900">Код партії:</span> {intakeDuplicateBatch.batchCode || '—'}</p>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setIntakeDuplicateBatch(null)}
              disabled={isCreatingIntake}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Скасувати
            </button>
            <button
              type="button"
              onClick={() => { void submitIntake('create_anyway'); }}
              disabled={isCreatingIntake}
              className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60"
            >
              Створити окремо
            </button>
            <button
              type="button"
              onClick={() => { void submitIntake('merge'); }}
              disabled={isCreatingIntake}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isCreatingIntake ? 'Збереження...' : 'Додати до існуючої'}
            </button>
          </div>
        </div>
      </div>
      ) : null}
      {intakeSuspiciousExpiryDateWarning ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Підтвердження дати</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">
            {intakeSuspiciousExpiryDateWarning.title || 'Перевірте термін придатності'}
          </h3>
          <p className="mt-2 text-sm text-slate-600">{intakeSuspiciousExpiryDateWarning.message}</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p><span className="font-semibold text-slate-900">Термін придатності:</span> {String(batchForm.expiryDate || '—')}</p>
            <p className="mt-1"><span className="font-semibold text-slate-900">Дата поставки:</span> {String(batchForm.deliveryDate || '—')}</p>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setIntakeSuspiciousExpiryDateWarning(null)}
              disabled={isCreatingIntake}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Повернутися
            </button>
            <button
              type="button"
              onClick={() => { void submitIntake(undefined, true); }}
              disabled={isCreatingIntake}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isCreatingIntake ? 'Збереження...' : 'Підтвердити і зберегти'}
            </button>
          </div>
        </div>
      </div>
      ) : null}
      </div>
    </div>
  );
}
