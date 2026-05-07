import type { RowDataPacket } from 'mysql2/promise';

import type { HomeBanner } from '@/content/home-banners';
import { formatBannerDateTimeForDb, normalizeBannerDateTimeInput } from '@/lib/banner-datetime';
import { getDbPool } from '@/lib/db';

type BannerRow = RowDataPacket & {
  id: number;
  title: string;
  image_url: string;
  target_url: string | null;
  sort_order: number;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  is_active: number;
};

function toBannerDateTime(value: Date | string | null): string | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    return normalizeBannerDateTimeInput(value);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function mapRowToBanner(row: BannerRow): HomeBanner {
  return {
    id: String(row.id),
    alt: row.title,
    src: row.image_url,
    href: row.target_url ?? undefined,
    isActive: row.is_active === 1,
    publishFrom: toBannerDateTime(row.starts_at),
    publishTo: toBannerDateTime(row.ends_at)
  };
}

export async function listBannersFromDb(): Promise<HomeBanner[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<BannerRow[]>(
    `
      SELECT id, title, image_url, target_url, sort_order, starts_at, ends_at, is_active
      FROM banners
      ORDER BY sort_order ASC, id DESC
    `
  );

  return rows.map(mapRowToBanner);
}

export async function replaceBannersInDb(banners: HomeBanner[]): Promise<HomeBanner[]> {
  const pool = getDbPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM banners');

    for (let index = 0; index < banners.length; index += 1) {
      const banner = banners[index];
      await conn.query(
        `
          INSERT INTO banners (title, image_url, target_url, sort_order, starts_at, ends_at, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          banner.alt,
          banner.src,
          banner.href ?? null,
          index,
          formatBannerDateTimeForDb(banner.publishFrom),
          formatBannerDateTimeForDb(banner.publishTo),
          banner.isActive ? 1 : 0
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

  return listBannersFromDb();
}
