import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import type { PromotionRecord } from '@/lib/promotion-types';

type PromotionRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  short_description: string | null;
  content: string | null;
  image_url: string | null;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  status: 'draft' | 'published' | 'archived';
  is_weekly: number;
  updated_at: Date | string;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function toIsoLocal(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 16);
}

function mapRow(row: PromotionRow): PromotionRecord {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description ?? '',
    content: row.content ?? '',
    imageUrl: row.image_url ?? '',
    startsAt: toIsoLocal(row.starts_at),
    endsAt: toIsoLocal(row.ends_at),
    status: row.status,
    isWeekly: row.is_weekly === 1,
    updatedAt: toIso(row.updated_at)
  };
}

export async function listPromotionsFromDb(): Promise<PromotionRecord[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<PromotionRow[]>(
    `
      SELECT id, slug, title, short_description, content, image_url, starts_at, ends_at, status, is_weekly, updated_at
      FROM promotions
      ORDER BY updated_at DESC
    `
  );

  return rows.map(mapRow);
}

export async function getPromotionBySlugFromDb(slug: string): Promise<PromotionRecord | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const pool = getDbPool();
  const [rows] = await pool.query<PromotionRow[]>(
    `
      SELECT id, slug, title, short_description, content, image_url, starts_at, ends_at, status, is_weekly, updated_at
      FROM promotions
      WHERE slug = ?
      LIMIT 1
    `,
    [normalizedSlug]
  );

  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function replacePromotionsInDb(items: PromotionRecord[]): Promise<PromotionRecord[]> {
  const pool = getDbPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM promotions');

    for (const item of items) {
      await conn.query(
        `
          INSERT INTO promotions (slug, title, short_description, content, image_url, starts_at, ends_at, status, is_weekly)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          item.slug,
          item.title,
          item.shortDescription || null,
          item.content || null,
          item.imageUrl || null,
          item.startsAt ? new Date(item.startsAt) : null,
          item.endsAt ? new Date(item.endsAt) : null,
          item.status,
          item.isWeekly ? 1 : 0
        ]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return listPromotionsFromDb();
}
