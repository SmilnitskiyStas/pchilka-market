import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  defaultInventoryTelegramSettings,
  INVENTORY_TELEGRAM_SETTINGS_KEY,
  normalizeInventoryTelegramSettings,
  type InventoryTelegramSettings
} from '@/lib/inventory-telegram-settings';

type SiteSettingRow = RowDataPacket & {
  setting_value: unknown;
};

export async function getInventoryTelegramSettingsFromDb(): Promise<InventoryTelegramSettings> {
  const pool = getDbPool();
  const [rows] = await pool.query<SiteSettingRow[]>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [INVENTORY_TELEGRAM_SETTINGS_KEY]
  );

  const rawValue = rows[0]?.setting_value;
  if (!rawValue) return defaultInventoryTelegramSettings;

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue) as Partial<InventoryTelegramSettings>;
      return normalizeInventoryTelegramSettings(parsed);
    } catch {
      return defaultInventoryTelegramSettings;
    }
  }

  return normalizeInventoryTelegramSettings(rawValue as Partial<InventoryTelegramSettings>);
}

export async function saveInventoryTelegramSettingsToDb(
  settings: InventoryTelegramSettings
): Promise<InventoryTelegramSettings> {
  const normalized = normalizeInventoryTelegramSettings(settings);

  const pool = getDbPool();
  await pool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [INVENTORY_TELEGRAM_SETTINGS_KEY, JSON.stringify(normalized)]
  );

  return normalized;
}
