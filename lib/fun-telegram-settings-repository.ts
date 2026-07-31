import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  defaultFunTelegramSettings,
  FUN_TELEGRAM_SETTINGS_KEY,
  normalizeFunTelegramSettings,
  type FunTelegramSettings
} from '@/lib/fun-telegram-settings';

type SiteSettingRow = RowDataPacket & { setting_value: unknown };

export async function getFunTelegramSettings(): Promise<FunTelegramSettings> {
  const [rows] = await getDbPool().query<SiteSettingRow[]>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [FUN_TELEGRAM_SETTINGS_KEY]
  );
  const value = rows[0]?.setting_value;
  if (typeof value !== 'string') return value ? normalizeFunTelegramSettings(value as Partial<FunTelegramSettings>) : defaultFunTelegramSettings;
  try {
    return normalizeFunTelegramSettings(JSON.parse(value) as Partial<FunTelegramSettings>);
  } catch {
    return defaultFunTelegramSettings;
  }
}

export async function saveFunTelegramSettings(settings: FunTelegramSettings): Promise<FunTelegramSettings> {
  const normalized = normalizeFunTelegramSettings(settings);
  await getDbPool().query(
    `INSERT INTO site_settings (setting_key, setting_value)
     VALUES (?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [FUN_TELEGRAM_SETTINGS_KEY, JSON.stringify(normalized)]
  );
  return normalized;
}
