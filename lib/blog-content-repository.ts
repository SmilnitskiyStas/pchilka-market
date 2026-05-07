import type { RowDataPacket } from 'mysql2/promise';

import type { BlogCategory } from '@/lib/blog-categories';
import { normalizeCategory } from '@/lib/blog-categories';
import type { ContentEntry } from '@/lib/content-entries';
import { normalizeContentEntry } from '@/lib/content-entries';
import { getDbPool } from '@/lib/db';

export const BLOG_CONTENT_SETTING_KEY = 'blog_content_v1';

type SiteSettingRow = RowDataPacket & {
  setting_value: unknown;
};

type BlogContentPayload = {
  entries: ContentEntry[];
  categories: BlogCategory[];
};

function normalizePayload(raw: unknown): BlogContentPayload {
  const safe = (raw ?? {}) as {
    entries?: Partial<ContentEntry>[];
    categories?: Partial<BlogCategory>[];
  };

  const entries = Array.isArray(safe.entries) ? safe.entries.map((item) => normalizeContentEntry(item ?? {})) : [];
  const categories = Array.isArray(safe.categories) ? safe.categories.map((item) => normalizeCategory(item ?? {})) : [];

  return { entries, categories };
}

export async function getBlogContentFromDb(): Promise<BlogContentPayload> {
  const pool = getDbPool();
  const [rows] = await pool.query<SiteSettingRow[]>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [BLOG_CONTENT_SETTING_KEY]
  );

  const rawValue = rows[0]?.setting_value;
  if (!rawValue) return { entries: [], categories: [] };

  if (typeof rawValue === 'string') {
    try {
      return normalizePayload(JSON.parse(rawValue));
    } catch {
      return { entries: [], categories: [] };
    }
  }

  return normalizePayload(rawValue);
}

export async function saveBlogContentToDb(payload: BlogContentPayload): Promise<BlogContentPayload> {
  const normalized = normalizePayload(payload);

  const pool = getDbPool();
  await pool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [BLOG_CONTENT_SETTING_KEY, JSON.stringify(normalized)]
  );

  return normalized;
}
