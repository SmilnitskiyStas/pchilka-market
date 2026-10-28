import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { isPageSlug, validateVisualPage, pageSnapshot, type VisualPage, type VisualPageRecord, type PageSaveAction } from '@/lib/visual-pages';

const PREFIX = 'visual_page_v1:';
type PageRow = RowDataPacket & { setting_value: string | VisualPageRecord };
export class PageConflictError extends Error {
  constructor() { super('Сторінку вже змінили в іншій вкладці. Відкрийте її повторно; ваш текст залишається в редакторі.'); }
}
function decode(row: PageRow): VisualPageRecord {
  return typeof row.setting_value === 'string' ? JSON.parse(row.setting_value) as VisualPageRecord : row.setting_value;
}
export async function listVisualPages(): Promise<VisualPageRecord[]> {
  const [rows] = await getDbPool().query<PageRow[]>(
    'SELECT setting_value FROM site_settings WHERE LEFT(setting_key, ?) = ? ORDER BY updated_at DESC', [PREFIX.length, PREFIX]
  );
  return rows.map(decode).filter((record) => record.draft);
}
export async function getVisualPage(slug: string, visited = new Set<string>()): Promise<VisualPageRecord | null> {
  if (!isPageSlug(slug)) return null;
  if (visited.has(slug) || visited.size > 100) return null;
  visited.add(slug);
  const [rows] = await getDbPool().query<PageRow[]>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1', [PREFIX + slug]
  );
  if (!rows[0]) return null;
  const record = decode(rows[0]);
  const redirectTo = (record as unknown as { redirectTo?: string }).redirectTo;
  return redirectTo ? getVisualPage(redirectTo, visited) : record;
}
export async function saveVisualPage(page: VisualPage, revision: number, action: PageSaveAction): Promise<VisualPageRecord> {
  const draft = validateVisualPage(page, action === 'publish');
  const previous = await getVisualPage(draft.slug);
  if (previous && previous.draft.slug !== draft.slug) throw new PageConflictError();
  if ((previous?.revision ?? 0) !== revision) throw new PageConflictError();
  const record: VisualPageRecord = {
    revision: revision + 1,
    draft,
    published: action === 'publish' ? draft : action === 'unpublish' ? null : previous?.published ?? null,
    updatedAt: new Date().toISOString(),
    history: previous ? [...(previous.history ?? []), pageSnapshot(previous)].slice(-20) : []
  };
  const pool = getDbPool();
  if (!revision) {
    try {
      await pool.query('INSERT INTO site_settings (setting_key, setting_value) VALUES (?, CAST(? AS JSON))', [PREFIX + draft.slug, JSON.stringify(record)]);
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw new PageConflictError();
      throw error;
    }
  } else {
    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE site_settings SET setting_value = CAST(? AS JSON), updated_at = CURRENT_TIMESTAMP WHERE setting_key = ? AND JSON_EXTRACT(setting_value, '$.revision') = ?",
      [JSON.stringify(record), PREFIX + draft.slug, revision]
    );
    if (!result.affectedRows) throw new PageConflictError();
  }
  return record;
}

export async function renameVisualPage(slug: string, newSlug: string, revision: number): Promise<VisualPageRecord> {
  if (!isPageSlug(slug) || !isPageSlug(newSlug) || slug === newSlug || slug === 'rental-intro' || newSlug === 'rental-intro') throw new Error('Оберіть нову адресу. Адресу області оренди змінювати не можна.');
  const previous = await getVisualPage(slug);
  if (!previous || previous.draft.slug !== slug || previous.revision !== revision) throw new PageConflictError();
  const record: VisualPageRecord = { ...previous, revision: revision + 1,
    draft: { ...previous.draft, slug: newSlug },
    published: previous.published ? { ...previous.published, slug: newSlug } : null,
    history: [...(previous.history ?? []), pageSnapshot(previous)].slice(-20), updatedAt: new Date().toISOString() };
  const connection = await getDbPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('INSERT INTO site_settings (setting_key, setting_value) VALUES (?, CAST(? AS JSON))', [PREFIX + newSlug, JSON.stringify(record)]);
    const [result] = await connection.query<ResultSetHeader>(
      "UPDATE site_settings SET setting_value = CAST(? AS JSON), updated_at = CURRENT_TIMESTAMP WHERE setting_key = ? AND JSON_EXTRACT(setting_value, '$.revision') = ?",
      [JSON.stringify({ redirectTo: newSlug, revision: revision + 1 }), PREFIX + slug, revision]);
    if (!result.affectedRows) throw new PageConflictError();
    await connection.commit();
    return record;
  } catch (error) {
    await connection.rollback();
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw new PageConflictError();
    throw error;
  } finally { connection.release(); }
}
