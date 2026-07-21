import type { UtilityChargeCalculationMode, UtilityType, UtilityValidationStatus } from '@/lib/utility-metering-types';

export type UtilityChargeInput = {
  utilityType: UtilityType;
  previousValue?: number | null;
  currentValue: number;
  coefficient?: number | null;
  rate?: number | null;
  calculationMode?: UtilityChargeCalculationMode;
  fixedAmount?: number | null;
  expectedAmount?: number | null;
  recentConsumptions?: number[];
  periodMonth?: string | null;
};

export type UtilityChargeCalculation = {
  previousValue?: number;
  currentValue: number;
  consumption?: number;
  coefficient: number;
  rate?: number;
  calculationMode: UtilityChargeCalculationMode;
  fixedAmount?: number;
  amount?: number;
  validationStatus: UtilityValidationStatus;
  validationMessages: string[];
};

const MONEY_EPSILON = 0.05;

export function normalizeUtilityType(label: string): UtilityType {
  const value = label.toLowerCase();
  if (value.includes('реактив')) return 'electricity_reactive';
  if (value.includes('елект') || value.includes('элект') || value.includes('квт') || value.includes('актив')) {
    return 'electricity_active';
  }
  if (value.includes('вод') || value.includes('хв')) return 'water';
  if (value.includes('тбо') || value.includes('сміт') || value.includes('мусор')) return 'waste';
  if (value.includes('експл') || value.includes('экспл')) return 'maintenance';
  if (value.includes('оренд') || value.includes('аренд')) return 'rent';
  return 'other';
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function finiteNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseUtilityMeterDecimal(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value !== 'string') return Number.NaN;

  const compact = value.trim().replace(/\s+/g, '');
  if (!compact) return Number.NaN;

  const commaIndex = compact.lastIndexOf(',');
  const dotIndex = compact.lastIndexOf('.');
  const normalized =
    commaIndex >= 0 && dotIndex >= 0
      ? commaIndex > dotIndex
        ? compact.replace(/\./g, '').replace(',', '.')
        : compact.replace(/,/g, '')
      : compact.replace(',', '.');

  return Number(normalized);
}

function formatPeriodMonthLabel(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[1]}-${match[2]}`;
}

export function calculateUtilityCharge(input: UtilityChargeInput): UtilityChargeCalculation {
  const coefficient = finiteNumber(input.coefficient) && Number(input.coefficient) !== 0 ? Number(input.coefficient) : 1;
  const rate = finiteNumber(input.rate) ? Number(input.rate) : undefined;
  const calculationMode: UtilityChargeCalculationMode = input.calculationMode === 'fixed_amount' ? 'fixed_amount' : 'rate';
  const fixedAmount = finiteNumber(input.fixedAmount) ? Number(input.fixedAmount) : undefined;
  const previousValue = finiteNumber(input.previousValue) ? Number(input.previousValue) : undefined;
  const currentValue = Number(input.currentValue);
  const validationMessages: string[] = [];

  if (!Number.isFinite(currentValue)) {
    return {
      currentValue: 0,
      coefficient,
      rate,
      calculationMode,
      fixedAmount,
      validationStatus: 'error',
      validationMessages: ['Поточний показник не є числом.']
    };
  }

  if (previousValue === undefined) {
    validationMessages.push('Немає попереднього показника для автоматичного розрахунку споживання.');
  }

  // Match the accounting workbook formula:
  // IF((current - previous) <= 0, "", (current - previous) * coefficient).
  // A non-positive difference is not billable consumption and must not create
  // a tariff-based amount.
  const readingDifference = previousValue === undefined ? undefined : currentValue - previousValue;
  const rawConsumption = readingDifference !== undefined && readingDifference > 0 ? readingDifference * coefficient : undefined;
  const consumption = rawConsumption === undefined ? undefined : Math.round((rawConsumption + Number.EPSILON) * 10000) / 10000;

  if (readingDifference !== undefined && readingDifference < 0) {
    validationMessages.push('Поточний показник менший за попередній.');
  }

  if (readingDifference === 0) {
    validationMessages.push('Споживання за період дорівнює нулю.');
  }

  const recent = (input.recentConsumptions ?? []).filter((item) => Number.isFinite(item) && item > 0);
  if (consumption !== undefined && consumption > 0 && recent.length >= 2) {
    const avg = recent.reduce((sum, item) => sum + item, 0) / recent.length;
    if (avg > 0 && consumption > avg * 2.5) {
      validationMessages.push(`Споживання значно вище середнього (${roundMoney(avg)}).`);
    }
  }

  if (calculationMode === 'fixed_amount' && (fixedAmount === undefined || fixedAmount < 0)) {
    validationMessages.push('Не вказано коректну суму з рахунку.');
  }

  if (calculationMode === 'rate' && rate === undefined && input.utilityType !== 'other') {
    const periodLabel = formatPeriodMonthLabel(input.periodMonth);
    validationMessages.push(
      periodLabel
        ? `Не знайдено тариф для періоду ${periodLabel}. Додайте тариф для цього лічильника або магазину на цей місяць чи раніше.`
        : 'Не знайдено тариф для періоду.'
    );
  }

  const amount =
    calculationMode === 'fixed_amount'
      ? fixedAmount == null || fixedAmount < 0
        ? undefined
        : roundMoney(fixedAmount)
      : consumption !== undefined && consumption >= 0 && rate !== undefined
        ? roundMoney(consumption * rate)
        : undefined;

  if (amount !== undefined && finiteNumber(input.expectedAmount)) {
    const expected = Number(input.expectedAmount);
    if (Math.abs(amount - expected) > MONEY_EPSILON) {
      validationMessages.push(`Сума не збігається з очікуваною: розраховано ${amount}, в Excel ${expected}.`);
    }
  }

  const validationStatus: UtilityValidationStatus =
    validationMessages.some((message) => message.includes('менший') || message.includes('не є числом')) ? 'error' :
    validationMessages.length > 0 ? 'warning' :
    'ok';

  return {
    previousValue,
    currentValue,
    consumption,
    coefficient,
    rate,
    calculationMode,
    fixedAmount,
    amount,
    validationStatus,
    validationMessages
  };
}
