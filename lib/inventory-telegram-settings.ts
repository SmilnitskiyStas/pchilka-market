export type InventoryTelegramSettings = {
  enabled: boolean;
  botToken: string;
  botUsername: string;
  webhookSecret: string;
  webhookPath: string;
  publicBaseUrl: string;
  staffChatId: string;
  adminChatId: string;
  defaultNotifiedDays: number;
  updatedAt: string;
};

export const INVENTORY_TELEGRAM_SETTINGS_KEY = 'inventory_telegram_settings_v1';

export const defaultInventoryTelegramSettings: InventoryTelegramSettings = {
  enabled: false,
  botToken: '',
  botUsername: '',
  webhookSecret: '',
  webhookPath: '/api/inventory/telegram/webhook',
  publicBaseUrl: '',
  staffChatId: '',
  adminChatId: '',
  defaultNotifiedDays: 7,
  updatedAt: ''
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWebhookPath(value: unknown): string {
  const normalized = normalizeString(value);
  if (!normalized) return defaultInventoryTelegramSettings.webhookPath;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function normalizeDays(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultInventoryTelegramSettings.defaultNotifiedDays;
  if (parsed < 1) return 1;
  if (parsed > 90) return 90;
  return Math.round(parsed);
}

export function normalizeInventoryTelegramSettings(
  raw: Partial<InventoryTelegramSettings> | null | undefined
): InventoryTelegramSettings {
  return {
    enabled: raw?.enabled ?? false,
    botToken: normalizeString(raw?.botToken),
    botUsername: normalizeString(raw?.botUsername).replace(/^@+/, ''),
    webhookSecret: normalizeString(raw?.webhookSecret),
    webhookPath: normalizeWebhookPath(raw?.webhookPath),
    publicBaseUrl: normalizeString(raw?.publicBaseUrl).replace(/\/+$/, ''),
    staffChatId: normalizeString(raw?.staffChatId),
    adminChatId: normalizeString(raw?.adminChatId),
    defaultNotifiedDays: normalizeDays(raw?.defaultNotifiedDays),
    updatedAt: normalizeString(raw?.updatedAt)
  };
}

export function buildInventoryWebhookUrl(settings: InventoryTelegramSettings): string {
  if (!settings.publicBaseUrl) return '';
  return `${settings.publicBaseUrl}${settings.webhookPath}`;
}

export function isValidTelegramBotToken(value: string): boolean {
  if (!value) return true;
  return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(value);
}

export function isValidTelegramBotUsername(value: string): boolean {
  if (!value) return true;
  return /^[A-Za-z0-9_]{5,64}$/.test(value);
}

export function isValidWebhookSecret(value: string): boolean {
  if (!value) return true;
  return /^[A-Za-z0-9_-]{12,120}$/.test(value);
}

export function isValidTelegramChatId(value: string): boolean {
  if (!value) return true;
  return /^-?\d{5,20}$/.test(value);
}
