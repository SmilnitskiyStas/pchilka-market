import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  defaultShockPriceSettings,
  normalizeShockPriceSettings,
  SHOCK_PRICE_SETTINGS_KEY,
  type ShockPriceSettings
} from '@/lib/shock-price-settings';

type SiteSettingRow = RowDataPacket & {
  setting_value: unknown;
};

export async function getShockPriceSettingsFromDb(): Promise<ShockPriceSettings> {
  const pool = getDbPool();
  const [rows] = await pool.query<SiteSettingRow[]>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [SHOCK_PRICE_SETTINGS_KEY]
  );

  const rawValue = rows[0]?.setting_value;
  if (!rawValue) return defaultShockPriceSettings;

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue) as Partial<ShockPriceSettings>;
      return normalizeShockPriceSettings(parsed);
    } catch {
      return defaultShockPriceSettings;
    }
  }

  return normalizeShockPriceSettings(rawValue as Partial<ShockPriceSettings>);
}

export async function saveShockPriceSettingsToDb(settings: ShockPriceSettings): Promise<ShockPriceSettings> {
  const normalized = normalizeShockPriceSettings(settings);

  const pool = getDbPool();
  await pool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [SHOCK_PRICE_SETTINGS_KEY, JSON.stringify(normalized)]
  );

  return normalized;
}
