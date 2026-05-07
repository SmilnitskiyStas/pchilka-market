import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  defaultSiteProfileSettings,
  normalizeSiteProfileSettings,
  SITE_PROFILE_SETTINGS_KEY,
  type SiteProfileSettings
} from '@/lib/site-profile-settings';

type SiteSettingRow = RowDataPacket & {
  setting_value: unknown;
};

export async function getSiteProfileFromDb(): Promise<SiteProfileSettings> {
  const pool = getDbPool();
  const [rows] = await pool.query<SiteSettingRow[]>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [SITE_PROFILE_SETTINGS_KEY]
  );

  const rawValue = rows[0]?.setting_value;
  if (!rawValue) return defaultSiteProfileSettings;

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue) as Partial<SiteProfileSettings>;
      return normalizeSiteProfileSettings(parsed);
    } catch {
      return defaultSiteProfileSettings;
    }
  }

  return normalizeSiteProfileSettings(rawValue as Partial<SiteProfileSettings>);
}

export async function saveSiteProfileToDb(settings: SiteProfileSettings): Promise<SiteProfileSettings> {
  const normalized = normalizeSiteProfileSettings(settings);

  const pool = getDbPool();
  await pool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [SITE_PROFILE_SETTINGS_KEY, JSON.stringify(normalized)]
  );

  return normalized;
}

