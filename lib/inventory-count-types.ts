export type InventoryCountSessionStatus = 'draft' | 'in_progress' | 'completed';

export type InventoryCountSessionRecord = {
  id: number;
  storeId: number;
  storeLabel: string;
  status: InventoryCountSessionStatus;
  scheduledFor: string;
  startedByUserId: number | null;
  startedByUserName: string;
  completedByUserId: number | null;
  completedByUserName: string;
  itemsCount: number;
  countedItemsCount: number;
  differencesCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
};

export type InventoryCountItemRecord = {
  id: number;
  sessionId: number;
  batchId: number;
  productId: number;
  expectedQuantity: number;
  countedQuantity: number | null;
  differenceQuantity: number | null;
  note: string;
  checkedByUserId: number | null;
  checkedByUserName: string;
  checkedAt: string;
  productNameSnapshot: string;
  articleSnapshot: string;
  barcodeSnapshot: string;
  unitsOfMeasurementSnapshot: string;
  expiryDateSnapshot: string;
  batchCodeSnapshot: string;
  createdAt: string;
  updatedAt: string;
};
