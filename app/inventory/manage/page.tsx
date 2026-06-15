'use client';

import { useEffect, useMemo, useState } from 'react';
import { uploadRequestAttachment } from '@/lib/request-attachment-client';
import {
  getSuspiciousInventoryExpiryDate,
  type SuspiciousInventoryExpiryDate
} from '@/lib/inventory-expiry-date-rules';
import { canEditInventoryBatchExpiry, canManageInventoryTaskMode, type InventoryUserRole } from '@/lib/inventory-user-roles';
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
  { value: 'wrong_year', label: 'РџРѕРјРёР»РєР° РІ СЂРѕС†С–' },
  { value: 'wrong_day_or_month', label: 'РџРѕРјРёР»РєР° РІ РґРЅС– Р°Р±Рѕ РјС–СЃСЏС†С–' },
  { value: 'label_rechecked', label: 'РџРµСЂРµРІС–СЂРµРЅРѕ РїРѕ РµС‚РёРєРµС‚С†С–' },
  { value: 'supplier_data_error', label: 'РџРѕРјРёР»РєР° РІ РґР°РЅРёС… РїРѕСЃС‚Р°С‡Р°Р»СЊРЅРёРєР°' },
  { value: 'other', label: 'Р†РЅС€Р° РїСЂРёС‡РёРЅР°' }
] as const;

const taskAssignmentModeOptions: Array<{
  value: InventoryTaskAssignmentMode;
  label: string;
  description: string;
}> = [
  {
    value: 'personal',
    label: 'РџРµСЂСЃРѕРЅР°Р»СЊРЅС– Р·Р°РґР°С‡С–',
    description: 'РљРѕР¶РµРЅ РїСЂР°С†С–РІРЅРёРє Р±Р°С‡РёС‚СЊ С– РѕС‚СЂРёРјСѓС” С‚С–Р»СЊРєРё СЃРІРѕС— Р·Р°РґР°С‡С–.'
  },
  {
    value: 'shared',
    label: 'РЎРїС–Р»СЊРЅРёР№ СЃРїРёСЃРѕРє РјР°РіР°Р·РёРЅСѓ',
    description: 'РЈСЃС– РїСЂР°С†С–РІРЅРёРєРё Р±Р°С‡Р°С‚СЊ СЃРїС–Р»СЊРЅРёР№ СЃРїРёСЃРѕРє С– Р±РµСЂСѓС‚СЊ Р·Р°РґР°С‡С– РІ СЂРѕР±РѕС‚Сѓ РІСЂСѓС‡РЅСѓ.'
  },
  {
    value: 'hybrid',
    label: 'Р—РјС–С€Р°РЅРёР№ СЂРµР¶РёРј',
    description: 'РљСЂРёС‚РёС‡РЅС– Р·Р°РґР°С‡С– РїРµСЂСЃРѕРЅР°Р»СЊРЅС–, С–РЅС€С– РґРѕСЃС‚СѓРїРЅС– Сѓ СЃРїС–Р»СЊРЅРѕРјСѓ СЃРїРёСЃРєСѓ РјР°РіР°Р·РёРЅСѓ.'
  }
];

function formatDaysLeft(value: number) {
  if (value < 0) return `РџСЂРѕСЃС‚СЂРѕС‡РµРЅРѕ РЅР° ${Math.abs(value)} РґРЅ.`;
  if (value === 0) return 'РЎРїР»РёРІР°С” СЃСЊРѕРіРѕРґРЅС–';
  return `Р—Р°Р»РёС€РёР»РѕСЃСЊ ${value} РґРЅ.`;
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
  if (!value) return 'вЂ”';
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
        label: batch.batchCode.trim() || `Р‘РµР· РєРѕРґСѓ РїРѕСЃС‚Р°РІРєРё вЂў РїР°СЂС‚С–СЏ #${batch.id}`,
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

            return (
              a.daysLeft - b.daysLeft ||
              a.expiryDate.localeCompare(b.expiryDate) ||
              Number(a.id) - Number(b.id)
            );
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
          throw new Error(payload.error || 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІР°РЅС‚Р°Р¶РёС‚Рё РєРµСЂСѓРІР°РЅРЅСЏ РјР°РіР°Р·РёРЅРѕРј.');
        }

        setCurrentUserRole(payload.user.role);
        setStoreLabel(payload.user.storeLabel);
        setTaskAssignmentMode(payload.taskAssignmentMode ?? 'personal');
        setUsers(payload.users);
        setStoreBatches(payload.storeBatches);
        setExpiringBatches(payload.expiringBatches);
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІР°РЅС‚Р°Р¶РёС‚Рё РєРµСЂСѓРІР°РЅРЅСЏ РјР°РіР°Р·РёРЅРѕРј.');
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
      return nextBatch.daysLeft <= 30
        ? next
        : next.filter((item) => item.id !== nextBatch.id);
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
        throw new Error(payload.error || 'РќРµ РІРґР°Р»РѕСЃСЏ РѕРЅРѕРІРёС‚Рё РїСЂР°С†С–РІРЅРёРєР°.');
      }

      setUsers((prev) => prev.map((item) => (item.id === payload.user?.id ? (payload.user as InventoryUserView) : item)));
      setSuccess(`РћРЅРѕРІР»РµРЅРѕ РїСЂР°С†С–РІРЅРёРєР°: ${payload.user.surname} ${payload.user.name}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'РќРµ РІРґР°Р»РѕСЃСЏ РѕРЅРѕРІРёС‚Рё РїСЂР°С†С–РІРЅРёРєР°.');
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
        throw new Error(payload.error || 'РќРµ РІРґР°Р»РѕСЃСЏ РѕРЅРѕРІРёС‚Рё СЂРµР¶РёРј Р·Р°РґР°С‡.');
      }

      setTaskAssignmentMode(payload.taskAssignmentMode ?? taskAssignmentMode);
      setSuccess('Р РµР¶РёРј СЂРѕР·РїРѕРґС–Р»Сѓ Р·Р°РґР°С‡ РѕРЅРѕРІР»РµРЅРѕ РґР»СЏ С†СЊРѕРіРѕ РјР°РіР°Р·РёРЅСѓ.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'РќРµ РІРґР°Р»РѕСЃСЏ РѕРЅРѕРІРёС‚Рё СЂРµР¶РёРј Р·Р°РґР°С‡.');
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
        throw new Error(payload.error || 'РќРµ РІРґР°Р»РѕСЃСЏ РїРµСЂРµРЅР°Р·РЅР°С‡РёС‚Рё РІС–РґРїРѕРІС–РґР°Р»СЊРЅРѕРіРѕ.');
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
      setSuccess(`РџР°СЂС‚С–СЋ ${payload.batch.productName} РїРµСЂРµРЅР°Р·РЅР°С‡РµРЅРѕ.`);
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'РќРµ РІРґР°Р»РѕСЃСЏ РїРµСЂРµРЅР°Р·РЅР°С‡РёС‚Рё РІС–РґРїРѕРІС–РґР°Р»СЊРЅРѕРіРѕ.');
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
          throw new Error('Р”РѕРґР°Р№С‚Рµ С„РѕС‚Рѕ С‚РѕРІР°СЂСѓ СЏРє РїС–РґС‚РІРµСЂРґР¶РµРЅРЅСЏ Р·РјС–РЅРё.');
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
        throw new Error(payload.error || 'РќРµ РІРґР°Р»РѕСЃСЏ Р·РјС–РЅРёС‚Рё С‚РµСЂРјС–РЅ РїСЂРёРґР°С‚РЅРѕСЃС‚С–.');
      }

      upsertBatch(payload.batch);
      setSuccess(
        `РўРµСЂРјС–РЅ РїСЂРёРґР°С‚РЅРѕСЃС‚С– РґР»СЏ "${payload.batch.productName}" Р·РјС–РЅРµРЅРѕ Р· ${payload.correction.oldExpiryDate} РЅР° ${payload.correction.newExpiryDate}.`
      );
      closeExpiryCorrectionModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'РќРµ РІРґР°Р»РѕСЃСЏ Р·РјС–РЅРёС‚Рё С‚РµСЂРјС–РЅ РїСЂРёРґР°С‚РЅРѕСЃС‚С–.');
    } finally {
      setIsSavingExpiryCorrection(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full rounded-3xl border border-brand/20 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Inventory / Store Management</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/inventory/tasks?token=${encodeURIComponent(token)}`}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              РќР°Р·Р°Рґ
            </a>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
            >
              РџРµСЂРµР·Р°РІР°РЅС‚Р°Р¶РёС‚Рё
            </button>
          </div>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">РљРµСЂСѓРІР°РЅРЅСЏ РїСЂР°С†С–РІРЅРёРєР°РјРё С– РїР°СЂС‚С–СЏРјРё РјР°РіР°Р·РёРЅСѓ</h1>
        <p className="mt-2 text-sm text-slate-600">
          Р”РѕСЃС‚СѓРїРЅРѕ РґР»СЏ СЂРѕР»РµР№ manager, store_manager С– admin. РўСѓС‚ РјРѕР¶РЅР° РѕРЅРѕРІР»СЋРІР°С‚Рё РїРѕСЃР°РґРё, СЂРѕР»С–, Р°РєС‚РёРІРЅС–СЃС‚СЊ РїСЂР°С†С–РІРЅРёРєС–РІ С–
          Р±Р°С‡РёС‚Рё РїРѕСЃС‚Р°РІРєРё РјР°РіР°Р·РёРЅСѓ Р· С‚РѕРІР°СЂР°РјРё, РєС–Р»СЊРєС–СЃС‚СЋ, СЃС‚СЂРѕРєР°РјРё С‚Р° РІС–РґРїРѕРІС–РґР°Р»СЊРЅРёРјРё.
        </p>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ...</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {!isLoading && !error ? (
          <>
            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">РњР°РіР°Р·РёРЅ</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{storeLabel || 'вЂ”'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Р РѕР»СЊ</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{currentUserRole}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Р¤РѕРєСѓСЃ</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {groupedStoreBatches.length} РїРѕСЃС‚Р°РІРѕРє / {storeBatches.length} РїР°СЂС‚С–Р№ Сѓ РїРѕС‚РѕС‡РЅРѕРјСѓ СЃРїРёСЃРєСѓ
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">РџРѕС€СѓРє РїРѕ С‚РѕРІР°СЂР°С… С– РїР°СЂС‚С–СЏС…</span>
                <input
                  value={manageFilter}
                  onChange={(event) => setManageFilter(event.target.value)}
                  placeholder="РќР°Р·РІР°, Р°СЂС‚РёРєСѓР», С€С‚СЂРёС…РєРѕРґ, РєРѕРґ РїРѕСЃС‚Р°РІРєРё, РїР°СЂС‚С–СЏ, РІС–РґРїРѕРІС–РґР°Р»СЊРЅРёР№"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Р¤С–Р»СЊС‚СЂ РѕРґРЅРѕС‡Р°СЃРЅРѕ Р·РІСѓР¶СѓС” РїРѕС‚РѕС‡РЅС– РїРѕСЃС‚Р°РІРєРё С– С‚РѕРІР°СЂРё Р·С– СЃС‚СЂРѕРєРѕРј, С‰Рѕ СЃРїР»РёРІР°С”.
              </p>
            </div>

            {canManageInventoryTaskMode(currentUserRole) ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Р РµР¶РёРј СЂРѕР·РїРѕРґС–Р»Сѓ Р·Р°РґР°С‡</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      РљРµСЂС–РІРЅРёРє РјР°РіР°Р·РёРЅСѓ РІРёСЂС–С€СѓС”, С‡Рё РїСЂР°С†С–РІРЅРёРєРё РѕС‚СЂРёРјСѓСЋС‚СЊ Р»РёС€Рµ СЃРІРѕС— Р·Р°РґР°С‡С–, С‡Рё РєРѕРјР°РЅРґР° РїСЂР°С†СЋС” Р·С– СЃРїС–Р»СЊРЅРёРј СЃРїРёСЃРєРѕРј.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveTaskAssignmentMode();
                    }}
                    disabled={isSavingTaskMode}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isSavingTaskMode ? 'Р—Р±РµСЂРµР¶РµРЅРЅСЏ...' : 'Р—Р±РµСЂРµРіС‚Рё СЂРµР¶РёРј'}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {taskAssignmentModeOptions.map((option) => {
                    const isSelected = taskAssignmentMode === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-2xl border p-4 transition ${
                          isSelected ? 'border-brand bg-brand/5' : 'border-slate-200 bg-slate-50 hover:border-brand/40'
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
                            <p className="mt-1 text-xs leading-5 text-slate-600">{option.description}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{'РџСЂР°С†С–РІРЅРёРєРё РјР°РіР°Р·РёРЅСѓ'}</h2>
                    <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{users.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUsersSectionOpen((prev) => !prev)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {isUsersSectionOpen ? 'Р—РіРѕСЂРЅСѓС‚Рё' : 'Р РѕР·РіРѕСЂРЅСѓС‚Рё'}
                  </button>
                </div>
                {isUsersSectionOpen ? (
                  <div className="mt-4 space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {user.surname} {user.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">chat_id: {user.userChatId}</p>
                      <div className="mt-3 grid gap-3">
                        <input
                          value={user.positionTitle}
                          onChange={(event) =>
                            setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, positionTitle: event.target.value } : item)))
                          }
                          placeholder="РџРѕСЃР°РґР°"
                          className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                        />
                        <div className="grid gap-3 md:grid-cols-2">
                          <select
                            value={user.role}
                            onChange={(event) =>
                              setUsers((prev) =>
                                prev.map((item) =>
                                  item.id === user.id ? { ...item, role: event.target.value as InventoryUserView['role'] } : item
                                )
                              )
                            }
                            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                          >
                            <option value="staff">staff</option>
                            <option value="manager">manager</option>
                            <option value="store_manager">store_manager</option>
                            {currentUserRole === 'admin' ? <option value="admin">admin</option> : null}
                          </select>
                          <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800">
                            <input
                              type="checkbox"
                              checked={user.isActive}
                              onChange={(event) =>
                                setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, isActive: event.target.checked } : item)))
                              }
                              className="h-4 w-4"
                            />
                            РђРєС‚РёРІРЅРёР№ РїСЂР°С†С–РІРЅРёРє
                          </label>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              void handleSaveUser(user);
                            }}
                            disabled={savingUserId === user.id}
                            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {savingUserId === user.id ? 'Р—Р±РµСЂРµР¶РµРЅРЅСЏ...' : 'РћРЅРѕРІРёС‚Рё РїСЂР°С†С–РІРЅРёРєР°'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">{'РЎРїРёСЃРѕРє РїСЂР°С†С–РІРЅРёРєС–РІ РїСЂРёС…РѕРІР°РЅРѕ. Р’С–РґРєСЂРёР№С‚Рµ Р±Р»РѕРє, СЏРєС‰Рѕ РїРѕС‚СЂС–Р±РЅРѕ Р·РјС–РЅРёС‚Рё СЂРѕР»С– Р°Р±Рѕ СЃС‚Р°С‚СѓСЃРё.'}</p>
                )}
              </section>

              <div className="space-y-6">
              <section>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">РџРѕС‚РѕС‡РЅС– РїРѕСЃС‚Р°РІРєРё РјР°РіР°Р·РёРЅСѓ</h2>
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {groupedStoreBatches.length} РїРѕСЃС‚Р°РІРѕРє
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  РћСЃС‚Р°РЅРЅС– РїР°СЂС‚С–С— Р·РіСЂСѓРїРѕРІР°РЅС– Р·Р° РєРѕРґРѕРј РїРѕСЃС‚Р°РІРєРё. РЈ РєРѕР¶РЅС–Р№ РїРѕСЃС‚Р°РІС†С– РІРёРґРЅРѕ С‚РѕРІР°СЂРё, РєС–Р»СЊРєС–СЃС‚СЊ, С‚РµСЂРјС–РЅ, С…С‚Рѕ РґРѕРґР°РІСЃСЏ СЏРє РІС–РґРїРѕРІС–РґР°Р»СЊРЅРёР№ С– РєРѕРіРѕ РјРѕР¶РЅР° РїСЂРёР·РЅР°С‡РёС‚Рё.
                </p>
                {storeBatches.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">РЈ РїРѕС‚РѕС‡РЅРѕРјСѓ РјР°РіР°Р·РёРЅС– С‰Рµ РЅРµРјР°С” РІРЅРµСЃРµРЅРёС… РїР°СЂС‚С–Р№.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {groupedStoreBatches.length === 0 ? (
                      <p className="text-sm text-slate-600">Р—Р° РІРёР±СЂР°РЅРёРј С„С–Р»СЊС‚СЂРѕРј Сѓ РїРѕС‚РѕС‡РЅРёС… РїРѕСЃС‚Р°РІРєР°С… РЅС–С‡РѕРіРѕ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.</p>
                    ) : null}
                    {groupedStoreBatches.map((supply) => (
                      <div
                        key={supply.key}
                        className={`rounded-2xl border p-4 ${
                          supply.hasFocusedBatch ? 'border-brand bg-brand/5' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">РџРѕСЃС‚Р°РІРєР°: {supply.label}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              РўРѕРІР°СЂС–РІ: {supply.productsCount} вЂў РїР°СЂС‚С–Р№: {supply.batchesCount} вЂў РєС–Р»СЊРєС–СЃС‚СЊ: {supply.totalQuantity}
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            РћРЅРѕРІР»РµРЅРѕ: {formatDate(supply.latestCreatedAt)}
                          </span>
                        </div>

                        <div className="mt-3 space-y-3">
                          {supply.products.map((product) => (
                            <div key={product.key} className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{product.productName}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    РђСЂС‚РёРєСѓР»: {product.article || 'вЂ”'} вЂў РЁРљ: {product.barcode || 'вЂ”'}
                                  </p>
                                </div>
                                <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {product.totalQuantity} РѕРґ.
                                </span>
                              </div>

                              <div className="mt-3 space-y-2">
                                {product.batches.map((batch) => (
                                  <div
                                    key={batch.id}
                                    className={`rounded-xl border p-3 ${
                                      focusedBatchId === batch.id ? 'border-brand bg-brand/5' : 'border-slate-200 bg-slate-50'
                                    }`}
                                  >
                                    <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                                      <p>
                                        <span className="font-semibold text-slate-900">РџР°СЂС‚С–СЏ #{batch.id}</span> вЂў {batch.quantity} РѕРґ.
                                      </p>
                                      <p>РўРµСЂРјС–РЅ: {batch.expiryDate} ({formatDaysLeft(batch.daysLeft)})</p>
                                      <p>Р”Р°С‚Р° РїРѕСЃС‚Р°РІРєРё: {batch.deliveryDate || 'вЂ”'}</p>
                                      <p>РЎС‚РІРѕСЂРµРЅРѕ: {formatDate(batch.createdAt)}</p>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-700">
                                      Р’С–РґРїРѕРІС–РґР°Р»СЊРЅРёР№: {batch.responsibleUserName || 'РЅРµ РїСЂРёР·РЅР°С‡РµРЅРѕ'}
                                    </p>
                                    <div className="mt-2 grid gap-1 text-sm text-slate-700">
                                      <p>РЎС‚Р°С‚СѓСЃ РїРµСЂРµРІС–СЂРєРё: {formatBatchCheckStatus(batch.checkStatus || 'new')}</p>
                                      <p>РћСЃС‚Р°РЅРЅСЏ РґС–СЏ: {formatBatchCheckStatus(batch.actionTaken || batch.checkStatus || 'new')}</p>
                                      {batch.actionNote ? <p>РџСЂРёРјС–С‚РєР°: {batch.actionNote}</p> : null}
                                    </div>
                                    <select
                                      value={batch.responsibleUserId}
                                      onChange={(event) => {
                                        void handleReassign(batch.id, event.target.value);
                                      }}
                                      disabled={assigningBatchId === batch.id}
                                      className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand disabled:opacity-60"
                                    >
                                      <option value="">Р‘РµР· РІС–РґРїРѕРІС–РґР°Р»СЊРЅРѕРіРѕ</option>
                                      {activeUsers.map((user) => (
                                        <option key={user.id} value={user.id}>
                                          {[`${user.surname} ${user.name}`, user.positionTitle].filter(Boolean).join(' | ')}
                                        </option>
                                      ))}
                                    </select>
                                    {canEditInventoryBatchExpiry(currentUserRole) ? (
                                      <a
                                        href={`/inventory/manage/expiry-date?token=${encodeURIComponent(token)}&batchId=${encodeURIComponent(batch.id)}`}
                                        className="mt-2 inline-flex rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
                                      >
                                        Р—РјС–РЅРёС‚Рё С‚РµСЂРјС–РЅ РїСЂРёРґР°С‚РЅРѕСЃС‚С–
                                      </a>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">РџРѕСЃС‚Р°РІРєРё С– С‚РѕРІР°СЂРё Р·С– СЃС‚СЂРѕРєРѕРј, С‰Рѕ СЃРїР»РёРІР°С”</h2>
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {groupedExpiringBatches.length} РїРѕСЃС‚Р°РІРѕРє
                  </span>
                </div>
                {expiringBatches.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">РЈ РїРѕС‚РѕС‡РЅРѕРјСѓ РјР°РіР°Р·РёРЅС– РЅРµРјР°С” РїР°СЂС‚С–Р№ Р·С– СЃС‚СЂРѕРєРѕРј РґРѕ 30 РґРЅС–РІ.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {groupedExpiringBatches.length === 0 ? (
                      <p className="text-sm text-slate-600">Р—Р° РІРёР±СЂР°РЅРёРј С„С–Р»СЊС‚СЂРѕРј Сѓ Р±Р»РѕС†С– С‚РµСЂРјС–РЅРѕРІРёС… С‚РѕРІР°СЂС–РІ РЅС–С‡РѕРіРѕ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.</p>
                    ) : null}
                    {groupedExpiringBatches.map((supply) => (
                      <div
                        key={supply.key}
                        className={`rounded-2xl border p-4 ${
                          supply.hasFocusedBatch
                            ? 'border-brand bg-brand/5'
                            : supply.minDaysLeft < 0
                              ? 'border-red-200 bg-red-50'
                              : supply.minDaysLeft <= 7
                                ? 'border-amber-200 bg-amber-50'
                                : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">РџРѕСЃС‚Р°РІРєР°: {supply.label}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              РўРѕРІР°СЂС–РІ: {supply.productsCount} вЂў РїР°СЂС‚С–Р№: {supply.batchesCount}
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {formatDaysLeft(supply.minDaysLeft)}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
                          <p>РќР°Р№Р±Р»РёР¶С‡РёР№ С‚РµСЂРјС–РЅ: {supply.nearestExpiryDate}</p>
                          <p>Р—Р°РіР°Р»СЊРЅР° РєС–Р»СЊРєС–СЃС‚СЊ: {supply.totalQuantity}</p>
                          <p>РљР°СЂС‚РѕРє Сѓ РїРѕСЃС‚Р°РІС†С–: {supply.batchesCount}</p>
                        </div>

                        <div className="mt-3 space-y-2">
                          {supply.products.map((product) => (
                            <div key={product.key} className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{product.productName}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    РђСЂС‚РёРєСѓР»: {product.article || 'вЂ”'} вЂў РЁРљ: {product.barcode || 'вЂ”'} вЂў РїР°СЂС‚С–Р№: {product.batchesCount}
                                  </p>
                                </div>
                                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  {formatDaysLeft(product.minDaysLeft)}
                                </span>
                              </div>

                              <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
                                <p>РќР°Р№Р±Р»РёР¶С‡РёР№ С‚РµСЂРјС–РЅ: {product.nearestExpiryDate}</p>
                                <p>Р—Р°РіР°Р»СЊРЅР° РєС–Р»СЊРєС–СЃС‚СЊ: {product.totalQuantity}</p>
                                <p>РљР°СЂС‚РѕРє РїРѕ С‚РѕРІР°СЂСѓ: {product.batchesCount}</p>
                              </div>

                              <div className="mt-3 space-y-2">
                                {product.batches.map((batch) => (
                                  <div
                                    key={batch.id}
                                    className={`rounded-xl border p-3 ${
                                      focusedBatchId === batch.id ? 'border-brand bg-brand/5' : 'border-slate-200 bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900">РџР°СЂС‚С–СЏ #{batch.id}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                          РљРѕРґ РїР°СЂС‚С–С—: {batch.batchCode || 'вЂ”'} вЂў РўРµСЂРјС–РЅ: {batch.expiryDate} вЂў РљС–Р»СЊРєС–СЃС‚СЊ: {batch.quantity}
                                        </p>
                                      </div>
                                      <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                        {formatDaysLeft(batch.daysLeft)}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-700">
                                      Р’С–РґРїРѕРІС–РґР°Р»СЊРЅРёР№: {batch.responsibleUserName || 'РЅРµ РїСЂРёР·РЅР°С‡РµРЅРѕ'}
                                    </p>
                                    <div className="mt-2 grid gap-1 text-sm text-slate-700">
                                      <p>РЎС‚Р°С‚СѓСЃ РїРµСЂРµРІС–СЂРєРё: {formatBatchCheckStatus(batch.checkStatus || 'new')}</p>
                                      <p>РћСЃС‚Р°РЅРЅСЏ РґС–СЏ: {formatBatchCheckStatus(batch.actionTaken || batch.checkStatus || 'new')}</p>
                                      {batch.actionNote ? <p>РџСЂРёРјС–С‚РєР°: {batch.actionNote}</p> : null}
                                    </div>
                                    <select
                                      value={batch.responsibleUserId}
                                      onChange={(event) => {
                                        void handleReassign(batch.id, event.target.value);
                                      }}
                                      disabled={assigningBatchId === batch.id}
                                      className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand disabled:opacity-60"
                                    >
                                      <option value="">Р‘РµР· РІС–РґРїРѕРІС–РґР°Р»СЊРЅРѕРіРѕ</option>
                                      {activeUsers.map((user) => (
                                        <option key={user.id} value={user.id}>
                                          {[`${user.surname} ${user.name}`, user.positionTitle].filter(Boolean).join(' | ')}
                                        </option>
                                      ))}
                                    </select>
                                    {canEditInventoryBatchExpiry(currentUserRole) ? (
                                      <a
                                        href={`/inventory/manage/expiry-date?token=${encodeURIComponent(token)}&batchId=${encodeURIComponent(batch.id)}`}
                                        className="mt-2 inline-flex rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
                                      >
                                        Р—РјС–РЅРёС‚Рё С‚РµСЂРјС–РЅ РїСЂРёРґР°С‚РЅРѕСЃС‚С–
                                      </a>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
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
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">РљРѕРЅС‚СЂРѕР»СЊРѕРІР°РЅР° Р·РјС–РЅР° РґР°С‚Рё</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">{editingExpiryBatch.productName}</h3>
            <p className="mt-2 text-sm text-slate-600">
              Р—РјС–РЅР° С‚РµСЂРјС–РЅСѓ РїСЂРёРґР°С‚РЅРѕСЃС‚С– Р·Р±РµСЂС–РіР°С”С‚СЊСЃСЏ РІ С–СЃС‚РѕСЂС–СЋ СЂР°Р·РѕРј С–Р· РїСЂРёС‡РёРЅРѕСЋ, РєРѕРјРµРЅС‚Р°СЂРµРј, С„РѕС‚Рѕ, РєРѕСЂРёСЃС‚СѓРІР°С‡РµРј С– С‡Р°СЃРѕРј Р·РјС–РЅРё.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">РЎС‚Р°СЂР° РґР°С‚Р°</span>
                <input
                  value={editingExpiryBatch.expiryDate}
                  readOnly
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">РќРѕРІР° РґР°С‚Р°</span>
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
                <span className="font-semibold text-slate-900">РџСЂРёС‡РёРЅР° Р·РјС–РЅРё</span>
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
              <label className="block text-sm">
                <span className="font-semibold text-slate-900">Р¤РѕС‚Рѕ С‚РѕРІР°СЂСѓ</span>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(event) => handleExpiryCorrectionPhotoChange(event.target.files?.[0] ?? null)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
                <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl border border-brand px-4 py-3 text-sm font-semibold text-brand transition hover:bg-brand/5">
                  Р—СЂРѕР±РёС‚Рё С„РѕС‚Рѕ
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
                  РџРµСЂС€РёР№ С–РЅРїСѓС‚ РІС–РґРєСЂРёРІР°С” РіР°Р»РµСЂРµСЋ, РґСЂСѓРіРёР№ РґРѕР·РІРѕР»СЏС” РѕРґСЂР°Р·Сѓ Р·СЂРѕР±РёС‚Рё С„РѕС‚Рѕ РєР°РјРµСЂРѕСЋ.
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {expiryCorrectionPhotoFile?.name || (expiryCorrectionPhotoUrl ? 'Р¤РѕС‚Рѕ РІР¶Рµ РґРѕРґР°РЅРѕ' : 'Р¤РѕС‚Рѕ РѕР±РѕРІвЂ™СЏР·РєРѕРІРµ')}
                </span>
              </label>
            </div>

            <label className="mt-4 block text-sm">
              <span className="font-semibold text-slate-900">РљРѕРјРµРЅС‚Р°СЂ</span>
              <textarea
                value={expiryCorrectionComment}
                onChange={(event) => setExpiryCorrectionComment(event.target.value)}
                rows={4}
                placeholder="РћРїРёС€С–С‚СЊ, С‰Рѕ СЃР°РјРµ РїРµСЂРµРІС–СЂРёР»Рё С– С‡РѕРјСѓ Р·РјС–РЅСЋС”С‚Рµ РґР°С‚Сѓ."
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </label>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold text-slate-900">РџР°СЂС‚С–СЏ:</span> #{editingExpiryBatch.id}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">РљРѕРґ РїР°СЂС‚С–С—:</span> {editingExpiryBatch.batchCode || 'вЂ”'}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">РљС–Р»СЊРєС–СЃС‚СЊ:</span> {editingExpiryBatch.quantity}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">Р”Р°С‚Р° РїРѕСЃС‚Р°РІРєРё:</span> {editingExpiryBatch.deliveryDate || 'вЂ”'}</p>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeExpiryCorrectionModal}
                disabled={isSavingExpiryCorrection}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                РЎРєР°СЃСѓРІР°С‚Рё
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveExpiryCorrection(false);
                }}
                disabled={isSavingExpiryCorrection}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSavingExpiryCorrection ? 'Р—Р±РµСЂРµР¶РµРЅРЅСЏ...' : 'Р—Р±РµСЂРµРіС‚Рё Р·РјС–РЅСѓ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {editingExpiryBatch && expiryCorrectionWarning ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">РџС–РґС‚РІРµСЂРґР¶РµРЅРЅСЏ РґР°С‚Рё</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              {expiryCorrectionWarning.title || 'РџРµСЂРµРІС–СЂС‚Рµ РЅРѕРІСѓ РґР°С‚Сѓ'}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{expiryCorrectionWarning.message}</p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold text-slate-900">РЎС‚Р°СЂР° РґР°С‚Р°:</span> {editingExpiryBatch.expiryDate}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">РќРѕРІР° РґР°С‚Р°:</span> {expiryCorrectionNewDate || 'вЂ”'}</p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setExpiryCorrectionWarning(null)}
                disabled={isSavingExpiryCorrection}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                РџРѕРІРµСЂРЅСѓС‚РёСЃСЏ
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveExpiryCorrection(true);
                }}
                disabled={isSavingExpiryCorrection}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSavingExpiryCorrection ? 'Р—Р±РµСЂРµР¶РµРЅРЅСЏ...' : 'РџС–РґС‚РІРµСЂРґРёС‚Рё Р·РјС–РЅСѓ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

