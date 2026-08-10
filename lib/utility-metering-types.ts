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
export type UtilityChargeCalculationMode = 'rate' | 'fixed_amount';

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
  initialReadingDate?: string;
  defaultRate?: number;
  areaSqM?: number;
  sourceKey: string;
  isActive: boolean;
};

export type UtilityMeterReadingRecord = {
  id: string;
  meterPointId: string;
  periodMonth: string;
  readingDate: string;
  submittedAt: string;
  readingValue: number;
  clientMutationId?: string;
  previousReadingId?: string;
  previousReadingDate?: string;
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
  calculationMode: UtilityChargeCalculationMode;
  fixedAmount?: number;
  invoiceReference: string;
  amount?: number;
  includesVat: boolean;
  amountWithoutVat?: number;
  amountWithVat?: number;
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

export type UtilityMeterRateRecord = {
  id: string;
  meterPointId?: string;
  storeId?: string;
  utilityType: UtilityType;
  periodMonth: string;
  rate: number;
  calculationMode: UtilityChargeCalculationMode;
  fixedAmount?: number;
  invoiceReference: string;
  rateLabel: string;
  includesVat: boolean;
  meterLabel: string;
  storeLabel: string;
  meterOwnerLabel?: string;
  meterLocationLabel?: string;
};

export type UtilityMeterCreateInput = {
  storeId: string | number;
  utilityType: UtilityType;
  utilityLabel: string;
  meterNumber?: string;
  coefficient?: number;
  initialReadingValue?: number;
  defaultRate?: number;
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

export type UtilityMeterRateInput = {
  rateId?: string | number;
  storeId?: string | number | null;
  meterPointId?: string | number | null;
  utilityType: UtilityType;
  periodMonth: string;
  rate: number;
  calculationMode?: UtilityChargeCalculationMode;
  fixedAmount?: number | null;
  invoiceReference?: string;
  rateLabel?: string;
  includesVat?: boolean;
};
