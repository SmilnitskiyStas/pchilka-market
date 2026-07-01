export type UtilityMeterOwnerKind = 'store' | 'tenant' | 'shared' | 'other';

export type UtilityType =
  | 'electricity_active'
  | 'electricity_reactive'
  | 'water'
  | 'waste'
  | 'maintenance'
  | 'rent'
  | 'other';

export type UtilityValidationStatus = 'ok' | 'warning' | 'error';

export type UtilityMeterPointRecord = {
  id: string;
  storeId?: string;
  storeCode: string;
  storeLabel: string;
  addressLine: string;
  ownerKind: UtilityMeterOwnerKind;
  tenantName: string;
  legalEntity: string;
  providerName: string;
  contractNumber: string;
  utilityType: UtilityType;
  utilityLabel: string;
  meterNumber: string;
  coefficient: number;
  initialReadingValue?: number;
  areaSqM?: number;
  sourceKey: string;
  isActive: boolean;
};

export type UtilityMeterReadingRecord = {
  id: string;
  meterPointId: string;
  periodMonth: string;
  readingDate: string;
  readingValue: number;
  previousReadingId?: string;
  submittedByUserId?: string;
  submittedByName: string;
  sourceKind: 'manual' | 'excel_import' | 'system';
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
};

export type UtilityMeterChargeRecord = {
  id: string;
  meterPointId: string;
  readingId: string;
  periodMonth: string;
  previousValue?: number;
  currentValue: number;
  consumption?: number;
  coefficient: number;
  rate?: number;
  amount?: number;
  validationStatus: UtilityValidationStatus;
  validationMessages: string[];
};

export type UtilityMeterReviewItem = UtilityMeterPointRecord & {
  reading?: UtilityMeterReadingRecord;
  charge?: UtilityMeterChargeRecord;
};

export type UtilityMeterReadingHistoryItem = {
  reading: UtilityMeterReadingRecord;
  charge?: UtilityMeterChargeRecord;
};

export type UtilityMeterCreateInput = {
  storeId: string | number;
  utilityType: UtilityType;
  utilityLabel: string;
  meterNumber?: string;
  coefficient?: number;
  initialReadingValue?: number;
  ownerKind?: UtilityMeterOwnerKind;
  tenantName?: string;
  legalEntity?: string;
  providerName?: string;
  contractNumber?: string;
  areaSqM?: number;
};

export type UtilityMeterUpdateInput = UtilityMeterCreateInput & {
  meterPointId: string | number;
  isActive?: boolean;
};
