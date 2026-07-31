export type FunTelegramSettings = {
  enabled: boolean;
  botToken: string;
  botUsername: string;
  webhookSecret: string;
  publicBaseUrl: string;
  allowedChatId: string;
  updatedAt: string;
};

export const FUN_TELEGRAM_SETTINGS_KEY = 'fun_telegram_settings_v1';

export const defaultFunTelegramSettings: FunTelegramSettings = {
  enabled: false,
  botToken: '',
  botUsername: '',
  webhookSecret: '',
  publicBaseUrl: '',
  allowedChatId: '',
  updatedAt: ''
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeFunTelegramSettings(raw: Partial<FunTelegramSettings> | null | undefined): FunTelegramSettings {
  return {
    enabled: raw?.enabled === true,
    botToken: text(raw?.botToken),
    botUsername: text(raw?.botUsername).replace(/^@+/, ''),
    webhookSecret: text(raw?.webhookSecret),
    publicBaseUrl: text(raw?.publicBaseUrl).replace(/\/+$/, ''),
    allowedChatId: text(raw?.allowedChatId),
    updatedAt: text(raw?.updatedAt)
  };
}

export function buildFunTelegramWebhookUrl(settings: FunTelegramSettings): string {
  return settings.publicBaseUrl ? `${settings.publicBaseUrl}/api/fun-telegram/webhook` : '';
}

export function isValidTelegramBotToken(value: string): boolean {
  return !value || /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(value);
}

export function isValidTelegramBotUsername(value: string): boolean {
  return !value || /^[A-Za-z0-9_]{5,64}$/.test(value);
}

export function isValidWebhookSecret(value: string): boolean {
  return !value || /^[A-Za-z0-9_-]{12,120}$/.test(value);
}

export function isValidTelegramChatId(value: string): boolean {
  return !value || /^-?\d{5,20}$/.test(value);
}
