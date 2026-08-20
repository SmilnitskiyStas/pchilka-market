import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

import { buildMediaUrl, getUploadsDir, resolveUploadPath } from '@/lib/uploads';

const execFileAsync = promisify(execFile);
const CATALOG_FOLDER = ['promotions', 'catalogs'];
const RENDER_FOLDER = ['promotions', 'catalog-renders'];

function getSafeCatalogParts(id: string): string[] {
  const parts = id.split('/').filter(Boolean);
  if (parts.length === 0 || path.extname(parts.at(-1) ?? '').toLowerCase() !== '.pdf') {
    throw new Error('Некоректний шлях до каталогу.');
  }
  return parts;
}

function getRenderParts(id: string): string[] {
  const parts = getSafeCatalogParts(id);
  const fileName = parts.at(-1) ?? 'catalog.pdf';
  return [...parts.slice(0, -1), fileName.replace(/\.pdf$/i, '')];
}

export async function getPromotionCatalogPageImages(id: string): Promise<string[]> {
  const renderParts = getRenderParts(id);
  const renderDir = resolveUploadPath([...RENDER_FOLDER, ...renderParts]);
  const entries = await fs.readdir(renderDir, { withFileTypes: true }).catch(() => []);

  return entries
    .filter((entry) => entry.isFile() && /^page-\d+\.webp$/i.test(entry.name))
    .sort((a, b) => Number(a.name.match(/\d+/)?.[0]) - Number(b.name.match(/\d+/)?.[0]))
    .map((entry) => buildMediaUrl([...RENDER_FOLDER, ...renderParts, entry.name]));
}

export async function renderPromotionCatalog(id: string): Promise<string[]> {
  const existing = await getPromotionCatalogPageImages(id);
  if (existing.length > 0) return existing;

  const sourcePath = resolveUploadPath([...CATALOG_FOLDER, ...getSafeCatalogParts(id)]);
  const renderParts = getRenderParts(id);
  const renderDir = resolveUploadPath([...RENDER_FOLDER, ...renderParts]);
  await fs.mkdir(renderDir, { recursive: true });
  const outputPrefix = path.join(renderDir, 'page');

  try {
    await execFileAsync('pdftoppm', ['-webp', '-r', '150', sourcePath, outputPrefix], { maxBuffer: 1024 * 1024 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Невідома помилка Poppler.';
    throw new Error(`Не вдалося підготувати сторінки каталогу: ${message}`);
  }

  return getPromotionCatalogPageImages(id);
}

export async function removePromotionCatalogRender(id: string): Promise<void> {
  const renderDir = resolveUploadPath([...RENDER_FOLDER, ...getRenderParts(id)]);
  await fs.rm(renderDir, { recursive: true, force: true });
}
