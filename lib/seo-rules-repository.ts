import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  parseSeoRulesFromUnknown,
  SEO_RULES_SETTING_KEY,
  type SeoRule
} from '@/lib/seo-settings';

type SiteSettingRow = RowDataPacket & {
  setting_value: unknown;
};

export async function getSeoRulesFromDb(): Promise<SeoRule[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<SiteSettingRow[]>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [SEO_RULES_SETTING_KEY]
  );

  const rawValue = rows[0]?.setting_value;
  if (!rawValue) return [];

  if (typeof rawValue === 'string') {
    try {
      return parseSeoRulesFromUnknown(JSON.parse(rawValue));
    } catch {
      return [];
    }
  }

  return parseSeoRulesFromUnknown(rawValue);
}

export async function saveSeoRulesToDb(rules: SeoRule[]): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [SEO_RULES_SETTING_KEY, JSON.stringify(rules)]
  );
}
