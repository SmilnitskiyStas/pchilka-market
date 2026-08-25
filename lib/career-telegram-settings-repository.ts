import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { CAREER_TELEGRAM_SETTINGS_KEY, defaultCareerTelegramSettings, normalizeCareerTelegramSettings, type CareerTelegramSettings } from '@/lib/career-telegram-settings';

type Row = RowDataPacket & { setting_value: unknown };

export async function getCareerTelegramSettings(): Promise<CareerTelegramSettings> {
  const [rows] = await getDbPool().query<Row[]>('SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1', [CAREER_TELEGRAM_SETTINGS_KEY]);
  const value = rows[0]?.setting_value;
  if (!value) return defaultCareerTelegramSettings;
  try { return normalizeCareerTelegramSettings(typeof value === 'string' ? JSON.parse(value) : value as Partial<CareerTelegramSettings>); }
  catch { return defaultCareerTelegramSettings; }
}

export async function saveCareerTelegramSettings(settings: CareerTelegramSettings) {
  const normalized = normalizeCareerTelegramSettings(settings);
  await getDbPool().query(
    'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, CAST(? AS JSON)) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP',
    [CAREER_TELEGRAM_SETTINGS_KEY, JSON.stringify(normalized)]
  );
  return normalized;
}
