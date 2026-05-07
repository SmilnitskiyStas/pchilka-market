import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  ANALYTICS_SETTINGS_KEY,
  defaultIntegrationsSettings,
  normalizeIntegrationsSettings,
  type IntegrationsSettings
} from '@/lib/integrations-settings';

type SiteSettingRow = RowDataPacket & {
  setting_value: unknown;
};

export async function getIntegrationsSettingsFromDb(): Promise<IntegrationsSettings> {
  const pool = getDbPool();
  const [rows] = await pool.query<SiteSettingRow[]>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [ANALYTICS_SETTINGS_KEY]
  );

  const rawValue = rows[0]?.setting_value;
  if (!rawValue) return defaultIntegrationsSettings;

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue) as Partial<IntegrationsSettings>;
      return normalizeIntegrationsSettings(parsed);
    } catch {
      return defaultIntegrationsSettings;
    }
  }

  return normalizeIntegrationsSettings(rawValue as Partial<IntegrationsSettings>);
}

export async function saveIntegrationsSettingsToDb(settings: IntegrationsSettings): Promise<IntegrationsSettings> {
  const normalized = normalizeIntegrationsSettings(settings);

  const pool = getDbPool();
  await pool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [ANALYTICS_SETTINGS_KEY, JSON.stringify(normalized)]
  );

  return normalized;
}
