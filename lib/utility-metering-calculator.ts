import type { UtilityType, UtilityValidationStatus } from '@/lib/utility-metering-types';

export type UtilityChargeInput = {
  utilityType: UtilityType;
  previousValue?: number | null;
  currentValue: number;
  coefficient?: number | null;
  rate?: number | null;
  expectedAmount?: number | null;
  recentConsumptions?: number[];
};

export type UtilityChargeCalculation = {
  previousValue?: number;
  currentValue: number;
  consumption?: number;
  coefficient: number;
  rate?: number;
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

export function calculateUtilityCharge(input: UtilityChargeInput): UtilityChargeCalculation {
  const coefficient = finiteNumber(input.coefficient) && Number(input.coefficient) !== 0 ? Number(input.coefficient) : 1;
  const rate = finiteNumber(input.rate) ? Number(input.rate) : undefined;
  const previousValue = finiteNumber(input.previousValue) ? Number(input.previousValue) : undefined;
  const currentValue = Number(input.currentValue);
  const validationMessages: string[] = [];

  if (!Number.isFinite(currentValue)) {
    return {
      currentValue: 0,
      coefficient,
      rate,
      validationStatus: 'error',
      validationMessages: ['Поточний показник не є числом.']
    };
  }

  if (previousValue === undefined) {
    validationMessages.push('Немає попереднього показника для автоматичного розрахунку споживання.');
  }

  const rawConsumption = previousValue === undefined ? undefined : (currentValue - previousValue) * coefficient;
  const consumption = rawConsumption === undefined ? undefined : Math.round((rawConsumption + Number.EPSILON) * 10000) / 10000;

  if (consumption !== undefined && consumption < 0) {
    validationMessages.push('Поточний показник менший за попередній.');
  }

  if (consumption !== undefined && consumption === 0) {
    validationMessages.push('Споживання за період дорівнює нулю.');
  }

  const recent = (input.recentConsumptions ?? []).filter((item) => Number.isFinite(item) && item > 0);
  if (consumption !== undefined && consumption > 0 && recent.length >= 2) {
    const avg = recent.reduce((sum, item) => sum + item, 0) / recent.length;
    if (avg > 0 && consumption > avg * 2.5) {
      validationMessages.push(`Споживання значно вище середнього (${roundMoney(avg)}).`);
    }
  }

  if (rate === undefined && input.utilityType !== 'other') {
    validationMessages.push('Не знайдено тариф для періоду.');
  }

  const amount = consumption !== undefined && consumption >= 0 && rate !== undefined ? roundMoney(consumption * rate) : undefined;

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
    amount,
    validationStatus,
    validationMessages
  };
}
