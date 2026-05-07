import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  normalizeShockPriceGallery,
  SHOCK_PRICE_GALLERY_KEY,
  type ShockPriceGalleryItem
} from '@/lib/shock-price-gallery';

type SiteSettingRow = RowDataPacket & {
  setting_value: unknown;
};

export async function getShockPriceGalleryFromDb(): Promise<ShockPriceGalleryItem[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<SiteSettingRow[]>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [SHOCK_PRICE_GALLERY_KEY]
  );

  const rawValue = rows[0]?.setting_value;
  if (!rawValue) return [];

  if (typeof rawValue === 'string') {
    try {
      return normalizeShockPriceGallery(JSON.parse(rawValue));
    } catch {
      return [];
    }
  }

  return normalizeShockPriceGallery(rawValue);
}

export async function saveShockPriceGalleryToDb(items: ShockPriceGalleryItem[]): Promise<ShockPriceGalleryItem[]> {
  const normalized = normalizeShockPriceGallery(items);

  const pool = getDbPool();
  await pool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [SHOCK_PRICE_GALLERY_KEY, JSON.stringify(normalized)]
  );

  return normalized;
}
