export type ShockPriceSortOrder = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

export type ShockPriceSettings = {
  columnsMobile: number;
  columnsTablet: number;
  columnsDesktop: number;
  maxItems: number;
  sortOrder: ShockPriceSortOrder;
  updatedAt: string;
};

export const SHOCK_PRICE_SETTINGS_KEY = 'shock_price_settings_v1';

export const defaultShockPriceSettings: ShockPriceSettings = {
  columnsMobile: 1,
  columnsTablet: 2,
  columnsDesktop: 3,
  maxItems: 0,
  sortOrder: 'newest',
  updatedAt: ''
};

function normalizeInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function normalizeSortOrder(value: unknown): ShockPriceSortOrder {
  if (value === 'oldest' || value === 'name_asc' || value === 'name_desc') return value;
  return 'newest';
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeShockPriceSettings(raw: Partial<ShockPriceSettings> | null | undefined): ShockPriceSettings {
  return {
    columnsMobile: normalizeInteger(raw?.columnsMobile, defaultShockPriceSettings.columnsMobile, 1, 2),
    columnsTablet: normalizeInteger(raw?.columnsTablet, defaultShockPriceSettings.columnsTablet, 1, 3),
    columnsDesktop: normalizeInteger(raw?.columnsDesktop, defaultShockPriceSettings.columnsDesktop, 1, 6),
    maxItems: normalizeInteger(raw?.maxItems, defaultShockPriceSettings.maxItems, 0, 200),
    sortOrder: normalizeSortOrder(raw?.sortOrder),
    updatedAt: normalizeString(raw?.updatedAt)
  };
}
