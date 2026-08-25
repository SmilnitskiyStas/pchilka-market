export type CareerTelegramSettings = {
  enabled: boolean;
  botToken: string;
  botUsername: string;
  webhookSecret: string;
  publicBaseUrl: string;
  hrChatId: string;
  cities: string[];
  updatedAt: string;
};

export const CAREER_TELEGRAM_SETTINGS_KEY = 'career_telegram_settings_v1';

export const defaultCareerTelegramSettings: CareerTelegramSettings = {
  enabled: false,
  botToken: '',
  botUsername: '',
  webhookSecret: '',
  publicBaseUrl: '',
  hrChatId: '',
  cities: ['Київ', 'Київська область', 'Одеса', 'Чернігів', 'Івано-Франківськ'],
  updatedAt: ''
};

function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }

export function normalizeCareerTelegramSettings(raw: Partial<CareerTelegramSettings> | null | undefined): CareerTelegramSettings {
  const cities = Array.isArray(raw?.cities)
    ? [...new Set(raw.cities.map(text).filter(Boolean))].slice(0, 20)
    : defaultCareerTelegramSettings.cities;
  return {
    enabled: raw?.enabled === true,
    botToken: text(raw?.botToken),
    botUsername: text(raw?.botUsername).replace(/^@+/, ''),
    webhookSecret: text(raw?.webhookSecret),
    publicBaseUrl: text(raw?.publicBaseUrl).replace(/\/+$/, ''),
    hrChatId: text(raw?.hrChatId),
    cities: cities.length ? cities : defaultCareerTelegramSettings.cities,
    updatedAt: text(raw?.updatedAt)
  };
}

export function buildCareerTelegramWebhookUrl(settings: CareerTelegramSettings) {
  return settings.publicBaseUrl ? `${settings.publicBaseUrl}/api/career-telegram/webhook` : '';
}

export function buildCareerTelegramStartUrl(settings: CareerTelegramSettings) {
  return settings.botUsername ? `https://t.me/${settings.botUsername}?start=vacancy_qr` : '';
}

export function isValidTelegramBotToken(value: string) { return !value || /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(value); }
export function isValidTelegramBotUsername(value: string) { return !value || /^[A-Za-z0-9_]{5,64}$/.test(value); }
export function isValidWebhookSecret(value: string) { return !value || /^[A-Za-z0-9_-]{12,120}$/.test(value); }
export function isValidTelegramChatId(value: string) { return !value || /^-?\d{5,20}$/.test(value); }
