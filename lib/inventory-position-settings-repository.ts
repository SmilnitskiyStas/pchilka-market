import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  defaultInventoryPositionTitles,
  findMatchingInventoryPositionTitle,
  INVENTORY_POSITION_SETTINGS_KEY,
  normalizeInventoryPositionTitle,
  normalizeInventoryPositionTitles
} from '@/lib/inventory-position-settings';

type SiteSettingRow = RowDataPacket & {
  setting_value: unknown;
};

export async function getInventoryPositionTitlesFromDb(): Promise<string[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<SiteSettingRow[]>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [INVENTORY_POSITION_SETTINGS_KEY]
  );

  const rawValue = rows[0]?.setting_value;
  if (!rawValue) {
    return defaultInventoryPositionTitles;
  }

  let storedTitles: string[] = [];
  if (typeof rawValue === 'string') {
    try {
      storedTitles = normalizeInventoryPositionTitles(JSON.parse(rawValue) as unknown);
    } catch {
      storedTitles = [];
    }
  } else {
    storedTitles = normalizeInventoryPositionTitles(rawValue);
  }

  return normalizeInventoryPositionTitles([...defaultInventoryPositionTitles, ...storedTitles]);
}

export async function saveInventoryPositionTitlesToDb(positionTitles: string[]): Promise<string[]> {
  const normalized = normalizeInventoryPositionTitles(positionTitles);

  const pool = getDbPool();
  await pool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [INVENTORY_POSITION_SETTINGS_KEY, JSON.stringify(normalized)]
  );

  return normalized;
}

export async function ensureInventoryPositionTitleInDb(value: string): Promise<string> {
  const normalized = normalizeInventoryPositionTitle(value);
  if (!normalized) return '';

  const currentTitles = await getInventoryPositionTitlesFromDb();
  const matchedTitle = findMatchingInventoryPositionTitle(currentTitles, normalized);
  if (matchedTitle) {
    return matchedTitle;
  }

  const nextTitles = await saveInventoryPositionTitlesToDb([...currentTitles, normalized]);
  return findMatchingInventoryPositionTitle(nextTitles, normalized) || normalized;
}
