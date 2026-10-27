import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getUploadsDir } from '@/lib/uploads';
import { getPromotionCatalogSettings, getPromotionCatalogMetadata } from '@/lib/promotion-catalog-metadata';
import { DEFAULT_CATALOG_PAGE_ID } from '@/lib/promotion-catalog-page-types';
import type { PromotionCatalogPage } from '@/lib/promotion-catalog-page-types';

function filePath() { return path.join(getUploadsDir(), 'promotions', 'catalogs', 'catalog-pages.json'); }

export function normalizeCatalogPage(raw: Partial<PromotionCatalogPage>): PromotionCatalogPage {
  const title = String(raw.title ?? '').trim().slice(0, 150);
  const slug = String(raw.slug ?? '').trim().toLowerCase();
  if (!title) throw new Error('Вкажіть назву сторінки.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new Error('Посилання має містити латинські літери, цифри й дефіси (до 80 символів).');
  }
  return { id: String(raw.id ?? ''), title, slug, description: String(raw.description ?? '').trim().slice(0, 1000), showArchive: raw.showArchive === true, showInList: raw.showInList !== false };
}

export async function getPromotionCatalogPages(): Promise<PromotionCatalogPage[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath(), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const settings = await getPromotionCatalogSettings();
    return [
      { id: 'f1', title: 'Каталог Ф1', slug: 'f1', description: 'Акційні пропозиції каталогу Ф1.', showArchive: settings.showArchive, showInList: true },
      { id: 'f3', title: 'Каталог Ф3', slug: 'f3', description: 'Акційні пропозиції каталогу Ф3.', showArchive: false, showInList: true }
    ];
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Не вдалося прочитати список сторінок каталогів.');
  return parsed.map((page) => normalizeCatalogPage(page));
}

let pendingWrite = Promise.resolve();

export async function hasCatalogsAssignedToPage(pageId: string): Promise<boolean> {
  const metadata = await getPromotionCatalogMetadata();
  const root = path.dirname(filePath());
  async function visit(directory: string, relative = ''): Promise<boolean> {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    });
    for (const entry of entries) {
      const id = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory() && await visit(path.join(directory, entry.name), id)) return true;
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf') && (metadata[id]?.pageId || DEFAULT_CATALOG_PAGE_ID) === pageId) return true;
    }
    return false;
  }
  return visit(root);
}

export async function updatePromotionCatalogPages(
  update: (pages: PromotionCatalogPage[]) => PromotionCatalogPage[]
): Promise<PromotionCatalogPage[]> {
  const operation = pendingWrite.then(async () => {
    const pages = update(await getPromotionCatalogPages());
    if (new Set(pages.map((page) => page.slug)).size !== pages.length) throw new Error('Сторінка з таким посиланням уже існує.');
    const target = filePath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(pages, null, 2), 'utf8');
    await fs.rename(temporary, target);
    return pages;
  });
  pendingWrite = operation.then(() => undefined, () => undefined);
  return operation;
}
