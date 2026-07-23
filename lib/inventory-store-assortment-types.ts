export type InventoryStoreAssortmentMatchStatus = 'matched' | 'unmatched';
export type InventoryStoreAssortmentSourceKind = 'import' | 'manual';

export type InventoryStoreAssortmentRecord = {
  id: string;
  storeId: string;
  productId: string;
  article: string;
  barcode: string;
  productName: string;
  unitsOfMeasurement: string;
  quantity: number | null;
  isPresent: boolean;
  matchStatus: InventoryStoreAssortmentMatchStatus;
  sourceKind: InventoryStoreAssortmentSourceKind;
  notes: string;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryStoreAssortmentSummary = {
  totalRows: number;
  presentRows: number;
  matchedRows: number;
  unmatchedRows: number;
  completionPercent: number;
  quantityTotal: number;
};

export type InventoryStoreAssortmentSnapshot = InventoryStoreAssortmentSummary & {
  id: string;
  storeId: string;
  snapshotDate: string;
  createdAt: string;
};

export type InventoryStoreAssortmentComparison = {
  requestedBaselineDate: string;
  requestedTargetDate: string;
  baselineSnapshot: InventoryStoreAssortmentSnapshot | null;
  targetSnapshot: InventoryStoreAssortmentSnapshot | null;
  delta: {
    totalRows: number;
    presentRows: number;
    matchedRows: number;
    unmatchedRows: number;
    completionPercent: number;
    quantityTotal: number;
  };
};

export type InventoryStoreAssortmentAllStoreComparisonRow = {
  storeId: string;
  storeLabel: string;
  baseline: InventoryStoreAssortmentSnapshot;
  target: InventoryStoreAssortmentSnapshot;
  delta: InventoryStoreAssortmentComparison['delta'];
};

export type InventoryStoreAssortmentAllStoreComparison = {
  requestedBaselineDate: string;
  requestedTargetDate: string;
  rows: InventoryStoreAssortmentAllStoreComparisonRow[];
  totals: InventoryStoreAssortmentComparison['delta'] & {
    storeCount: number;
  };
};

export type InventoryStoreAssortmentImportRow = {
  article: string;
  barcode: string;
  productName: string;
  unitsOfMeasurement: string;
  quantity: number | null;
};

export type InventoryStoreAssortmentManualInput = {
  productId: string | number;
  quantity?: number | null;
  isPresent?: boolean;
  notes?: string;
};

export type InventoryStoreAssortmentUpdateInput = {
  itemId: string | number;
  quantity?: number | null;
  isPresent?: boolean;
  notes?: string;
  productId?: string | number | null;
};
