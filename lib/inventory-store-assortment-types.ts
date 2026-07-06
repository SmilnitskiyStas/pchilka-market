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
