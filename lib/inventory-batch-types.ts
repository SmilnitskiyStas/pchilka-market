export type InventoryBatchRecord = {
  id: string;
  productId: string;
  productName: string;
  article: string;
  barcode: string;
  storeId: string;
  storeLabel: string;
  batchCode: string;
  quantity: number;
  quantityReceived: number;
  quantityCurrent: number;
  batchStatus: string;
  expiryDate: string;
  deliveryDate: string;
  notifiedDays: number;
  checkStatus: string;
  actionTaken: string;
  actionNote: string;
  checkedFollowupAction: string;
  doNotTrack: boolean;
  doNotTrackReason: string;
  responsibleUserId: string;
  responsibleUserName: string;
  createdByUserId: string;
  createdByUserName: string;
  discussionRequired: boolean;
  discussionNote: string;
  adminDecision: string;
  adminDecisionNote: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryBatchOverviewMetrics = {
  totalBatches: number;
  totalQuantity: number;
  expiringSoonCount: number;
  overdueCount: number;
  needsActionCount: number;
  unassignedCount: number;
};

export type InventoryAnalyticsStatusCards = {
  new: number;
  checked: number;
  writeoff: number;
  discussion: number;
};

export type InventoryAnalyticsRiskCards = {
  critical: number;
  high: number;
  medium: number;
  safe: number;
  overdue: number;
};

export type InventoryAnalyticsStoreRow = {
  id: string;
  label: string;
  batches: number;
  overdue: number;
  expiring: number;
  attention: number;
  currentQuantity: number;
};

export type InventoryAnalyticsEmployeeRow = {
  id: number;
  name: string;
  storeLabel: string;
  role: string;
  responsibleCount: number;
  attention: number;
  completed: number;
  overdue: number;
  expiring: number;
  completionRatio: number;
};

export type InventoryAnalyticsMetrics = {
  stockReceived: number;
  stockCurrent: number;
  stockDelta: number;
  uniqueRiskStoresCount: number;
  totalBatches: number;
  periodBatches: number;
  totalUsers: number;
  analyticsDateFrom: string;
  analyticsDateTo: string;
  analyticsStoreId: string;
  statusCards: InventoryAnalyticsStatusCards;
  riskCards: InventoryAnalyticsRiskCards;
  storeRows: InventoryAnalyticsStoreRow[];
  employeeRows: InventoryAnalyticsEmployeeRow[];
};

export type InventoryBatchInput = {
  productId?: string;
  storeId?: string;
  batchCode?: string;
  quantity?: number;
  quantityReceived?: number;
  expiryDate?: string;
  deliveryDate?: string;
  notifiedDays?: number | string | null;
};

export function normalizeInventoryBatchInput(raw: InventoryBatchInput | null | undefined) {
  const quantity = Number(raw?.quantity ?? 0);
  const quantityReceived = Number(raw?.quantityReceived ?? raw?.quantity ?? 0);
  const notifiedDaysRaw = raw?.notifiedDays;
  const parsedNotifiedDays =
    notifiedDaysRaw == null || notifiedDaysRaw === '' ? null : Number(notifiedDaysRaw);

  return {
    productId: String(raw?.productId ?? '').trim(),
    storeId: String(raw?.storeId ?? '').trim(),
    batchCode: String(raw?.batchCode ?? '').trim(),
    quantity: Number.isFinite(quantity) ? Math.max(Math.round(quantity), 0) : 0,
    quantityReceived: Number.isFinite(quantityReceived) ? Math.max(Math.round(quantityReceived), 0) : 0,
    expiryDate: String(raw?.expiryDate ?? '').trim(),
    deliveryDate: String(raw?.deliveryDate ?? '').trim(),
    notifiedDays:
      parsedNotifiedDays == null || !Number.isFinite(parsedNotifiedDays)
        ? null
        : Math.min(Math.max(Math.round(parsedNotifiedDays), 1), 90)
  };
}
