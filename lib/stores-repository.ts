import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { normalizeStore, type StoreRecord } from '@/lib/store-types';

type StoreRow = RowDataPacket & {
  id: number;
  store_code: string | null;
  name: string;
  region: string | null;
  city: string;
  address_line: string;
  phone: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  work_hours: string | null;
  is_active: number;
  sort_order: number;
};

type StoreReferenceRow = RowDataPacket & {
  users_count: number;
  batches_count: number;
  activity_logs_count: number;
  notification_logs_count: number;
};

function mapRow(row: StoreRow): StoreRecord {
  return {
    id: String(row.id),
    storeCode: row.store_code ?? '',
    name: row.name,
    region: row.region ?? '',
    city: row.city,
    addressLine: row.address_line,
    phone: row.phone ?? '',
    latitude: row.latitude == null ? '' : String(row.latitude),
    longitude: row.longitude == null ? '' : String(row.longitude),
    workHours: row.work_hours ?? '',
    isActive: row.is_active === 1,
    sortOrder: row.sort_order
  };
}

function toDecimalOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function listStoresFromDb(): Promise<StoreRecord[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<StoreRow[]>(
    `
      SELECT id, store_code, name, region, city, address_line, phone, latitude, longitude, work_hours, is_active, sort_order
      FROM stores
      ORDER BY sort_order ASC, city ASC, id ASC
    `
  );

  return rows.map(mapRow);
}

export async function replaceStoresInDb(stores: StoreRecord[]): Promise<StoreRecord[]> {
  const normalized = stores.map(normalizeStore);
  const pool = getDbPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [existingRows] = await conn.query<Array<RowDataPacket & { id: number }>>('SELECT id FROM stores');
    const existingIds = new Set(existingRows.map((row) => row.id));
    const incomingExistingIds = new Set<number>();

    for (let index = 0; index < normalized.length; index += 1) {
      const item = normalized[index];
      const numericId = Number(item.id);
      const values = [
        item.storeCode || null,
        item.name,
        item.region || null,
        item.city,
        item.addressLine,
        item.phone || null,
        toDecimalOrNull(item.latitude),
        toDecimalOrNull(item.longitude),
        item.workHours || null,
        item.isActive ? 1 : 0,
        index
      ];

      if (Number.isFinite(numericId) && numericId > 0 && existingIds.has(numericId)) {
        incomingExistingIds.add(numericId);
        await conn.query(
          `
            UPDATE stores
            SET
              store_code = ?,
              name = ?,
              region = ?,
              city = ?,
              address_line = ?,
              phone = ?,
              latitude = ?,
              longitude = ?,
              work_hours = ?,
              is_active = ?,
              sort_order = ?
            WHERE id = ?
          `,
          [...values, numericId]
        );
        continue;
      }

      const [result] = await conn.query<ResultSetHeader>(
        `
          INSERT INTO stores (store_code, name, region, city, address_line, phone, latitude, longitude, work_hours, is_active, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        values
      );
      incomingExistingIds.add(result.insertId);
    }

    const idsToRemove = Array.from(existingIds).filter((id) => !incomingExistingIds.has(id));
    for (const storeId of idsToRemove) {
      const [referenceRows] = await conn.query<StoreReferenceRow[]>(
        `
          SELECT
            (SELECT COUNT(*) FROM users WHERE store_id = ?) AS users_count,
            (SELECT COUNT(*) FROM product_batches WHERE store_id = ?) AS batches_count,
            (SELECT COUNT(*) FROM activity_logs WHERE store_id = ?) AS activity_logs_count,
            (SELECT COUNT(*) FROM notification_logs WHERE store_id = ?) AS notification_logs_count
        `,
        [storeId, storeId, storeId, storeId]
      );
      const references = referenceRows[0];
      const totalReferences =
        Number(references?.users_count ?? 0) +
        Number(references?.batches_count ?? 0) +
        Number(references?.activity_logs_count ?? 0) +
        Number(references?.notification_logs_count ?? 0);

      if (totalReferences > 0) {
        throw new Error(
          `Магазин #${storeId} не можна видалити: до нього прив'язані користувачі, партії або журнали. Спочатку перенесіть ці записи або деактивуйте магазин.`
        );
      }

      await conn.query('DELETE FROM stores WHERE id = ?', [storeId]);
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return listStoresFromDb();
}
