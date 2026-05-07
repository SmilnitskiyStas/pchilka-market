'use client';

import { useEffect, useMemo, useState } from 'react';
import { type InventoryUserRole } from '@/lib/inventory-user-roles';

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
  error?: string;
};

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
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
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
    existingProduct.batches.push(batch);
  }

  return Array.from(supplyGroups.values())
    .map((supply) => ({
      ...supply,
      productsCount: supply.products.length,
      products: supply.products
        .map((product) => ({
          ...product,
          batches: [...product.batches].sort(
            (a, b) =>
              a.daysLeft - b.daysLeft ||
              a.expiryDate.localeCompare(b.expiryDate) ||
              Number(a.id) - Number(b.id)
          )
        }))
        .sort((a, b) => a.minDaysLeft - b.minDaysLeft || a.productName.localeCompare(b.productName, 'uk'))
    }))
    .sort((a, b) => {
      if (sortMode === 'recent') {
        return b.latestCreatedAt.localeCompare(a.latestCreatedAt) || a.label.localeCompare(b.label, 'uk');
      }

      return a.minDaysLeft - b.minDaysLeft || a.label.localeCompare(b.label, 'uk');
    });
}

export default function InventoryManagePage() {
  const [token, setToken] = useState('');
  const [focusedBatchId, setFocusedBatchId] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<InventoryUserRole>('staff');
  const [storeLabel, setStoreLabel] = useState('');
  const [users, setUsers] = useState<InventoryUserView[]>([]);
  const [storeBatches, setStoreBatches] = useState<ExpiringBatchView[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<ExpiringBatchView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [assigningBatchId, setAssigningBatchId] = useState<string>('');
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
          throw new Error(payload.error || 'Не вдалося завантажити керування магазином.');
        }

        setCurrentUserRole(payload.user.role);
        setStoreLabel(payload.user.storeLabel);
        setUsers(payload.users);
        setStoreBatches(payload.storeBatches);
        setExpiringBatches(payload.expiringBatches);
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити керування магазином.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const activeUsers = useMemo(() => users.filter((item) => item.isActive), [users]);
  const groupedStoreBatches = useMemo(
    () => groupBatchesBySupply(storeBatches, focusedBatchId, 'recent'),
    [storeBatches, focusedBatchId]
  );
  const groupedExpiringBatches = useMemo(
    () => groupBatchesBySupply(expiringBatches, focusedBatchId, 'expiry'),
    [expiringBatches, focusedBatchId]
  );

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full rounded-3xl border border-brand/20 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Inventory / Store Management</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Керування працівниками і партіями магазину</h1>
        <p className="mt-2 text-sm text-slate-600">
          Доступно для ролей manager, store_manager і admin. Тут можна оновлювати посади, ролі, активність працівників і
          бачити поставки магазину з товарами, кількістю, строками та відповідальними.
        </p>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження...</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {!isLoading && !error ? (
          <>
            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Магазин</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{storeLabel || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Роль</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{currentUserRole}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Фокус</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {groupedStoreBatches.length} поставок / {storeBatches.length} партій у поточному списку
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Працівники магазину</h2>
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{users.length}</span>
                </div>
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
                          placeholder="Посада"
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
                            Активний працівник
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
                            {savingUserId === user.id ? 'Збереження...' : 'Оновити працівника'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Поточні поставки магазину</h2>
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {groupedStoreBatches.length} поставок
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Останні партії згруповані за кодом поставки. У кожній поставці видно товари, кількість, термін, хто додався як відповідальний і кого можна призначити.
                </p>
                {storeBatches.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">У поточному магазині ще немає внесених партій.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {groupedStoreBatches.map((supply) => (
                      <div
                        key={supply.key}
                        className={`rounded-2xl border p-4 ${
                          supply.hasFocusedBatch ? 'border-brand bg-brand/5' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Поставка: {supply.label}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Товарів: {supply.productsCount} • партій: {supply.batchesCount} • кількість: {supply.totalQuantity}
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            Оновлено: {formatDate(supply.latestCreatedAt)}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {supply.products.map((product) => (
                            <div key={product.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{product.productName}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Артикул: {product.article || '—'} • ШК: {product.barcode || '—'}
                                  </p>
                                </div>
                                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  {product.totalQuantity} од.
                                </span>
                              </div>

                              <div className="mt-3 space-y-2">
                                {product.batches.map((batch) => (
                                  <div
                                    key={batch.id}
                                    className={`rounded-xl border p-3 ${
                                      focusedBatchId === batch.id ? 'border-brand bg-white' : 'border-slate-200 bg-white'
                                    }`}
                                  >
                                    <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                                      <p>
                                        <span className="font-semibold text-slate-900">Партія #{batch.id}</span> • {batch.quantity} од.
                                      </p>
                                      <p>Термін: {batch.expiryDate} ({formatDaysLeft(batch.daysLeft)})</p>
                                      <p>Дата поставки: {batch.deliveryDate || '—'}</p>
                                      <p>Створено: {formatDate(batch.createdAt)}</p>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-700">
                                      Відповідальний: {batch.responsibleUserName || 'не призначено'}
                                    </p>
                                    <div className="mt-2 grid gap-1 text-sm text-slate-700">
                                      <p>Статус перевірки: {formatBatchCheckStatus(batch.checkStatus || 'new')}</p>
                                      <p>Остання дія: {formatBatchCheckStatus(batch.actionTaken || batch.checkStatus || 'new')}</p>
                                      {batch.actionNote ? <p>Примітка: {batch.actionNote}</p> : null}
                                    </div>
                                    <select
                                      value={batch.responsibleUserId}
                                      onChange={(event) => {
                                        void handleReassign(batch.id, event.target.value);
                                      }}
                                      disabled={assigningBatchId === batch.id}
                                      className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand disabled:opacity-60"
                                    >
                                      <option value="">Без відповідального</option>
                                      {activeUsers.map((user) => (
                                        <option key={user.id} value={user.id}>
                                          {[`${user.surname} ${user.name}`, user.positionTitle].filter(Boolean).join(' | ')}
                                        </option>
                                      ))}
                                    </select>
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
                  <h2 className="text-lg font-semibold text-slate-900">Поставки і товари зі строком, що спливає</h2>
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {groupedExpiringBatches.length} поставок
                  </span>
                </div>
                {expiringBatches.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">У поточному магазині немає партій зі строком до 30 днів.</p>
                ) : (
                  <div className="mt-4 space-y-3">
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
                            <p className="text-sm font-semibold text-slate-900">Поставка: {supply.label}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Товарів: {supply.productsCount} • партій: {supply.batchesCount}
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {formatDaysLeft(supply.minDaysLeft)}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 md:grid-cols-3">
                          <p>Найближчий термін: {supply.nearestExpiryDate}</p>
                          <p>Загальна кількість: {supply.totalQuantity}</p>
                          <p>Карток у поставці: {supply.batchesCount}</p>
                        </div>

                        <div className="mt-3 space-y-2">
                          {supply.products.map((product) => (
                            <div
                              key={product.key}
                              className={`rounded-xl border p-3 ${
                                product.hasFocusedBatch ? 'border-brand bg-brand/5' : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{product.productName}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Артикул: {product.article || '—'} • ШК: {product.barcode || '—'} • партій: {product.batchesCount}
                                  </p>
                                </div>
                                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  {formatDaysLeft(product.minDaysLeft)}
                                </span>
                              </div>

                              <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 md:grid-cols-3">
                                <p>Найближчий термін: {product.nearestExpiryDate}</p>
                                <p>Загальна кількість: {product.totalQuantity}</p>
                                <p>Карток по товару: {product.batchesCount}</p>
                              </div>

                              <div className="mt-3 space-y-2">
                                {product.batches.map((batch) => (
                                  <div
                                    key={batch.id}
                                    className={`rounded-xl border p-3 ${
                                      focusedBatchId === batch.id ? 'border-brand bg-white' : 'border-slate-200 bg-white'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900">Партія #{batch.id}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                          Код партії: {batch.batchCode || '—'} • Термін: {batch.expiryDate} • Кількість: {batch.quantity}
                                        </p>
                                      </div>
                                      <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                        {formatDaysLeft(batch.daysLeft)}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-700">
                                      Відповідальний: {batch.responsibleUserName || 'не призначено'}
                                    </p>
                                    <div className="mt-2 grid gap-1 text-sm text-slate-700">
                                      <p>Статус перевірки: {formatBatchCheckStatus(batch.checkStatus || 'new')}</p>
                                      <p>Остання дія: {formatBatchCheckStatus(batch.actionTaken || batch.checkStatus || 'new')}</p>
                                      {batch.actionNote ? <p>Примітка: {batch.actionNote}</p> : null}
                                    </div>
                                    <select
                                      value={batch.responsibleUserId}
                                      onChange={(event) => {
                                        void handleReassign(batch.id, event.target.value);
                                      }}
                                      disabled={assigningBatchId === batch.id}
                                      className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand disabled:opacity-60"
                                    >
                                      <option value="">Без відповідального</option>
                                      {activeUsers.map((user) => (
                                        <option key={user.id} value={user.id}>
                                          {[`${user.surname} ${user.name}`, user.positionTitle].filter(Boolean).join(' | ')}
                                        </option>
                                      ))}
                                    </select>
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
    </main>
  );
}
