import { promises as fs } from 'fs';
import path from 'path';
import type { PromotionCatalog } from '@/components/promotion-catalog-viewer';
import { getPromotionCatalogMetadata } from '@/lib/promotion-catalog-metadata';
import { DEFAULT_CATALOG_PAGE_ID } from '@/lib/promotion-catalog-page-types';
import { renderPromotionCatalog } from '@/lib/promotion-catalog-renderer';
import { buildMediaUrl, getUploadsDir } from '@/lib/uploads';

async function readPdfPageCount(absolutePath: string): Promise<number> {
  try {
    const fileBuffer = await fs.readFile(absolutePath);
    const fileContent = fileBuffer.toString('latin1');
    const countMatches = fileContent.match(/\/Count\s+(\d+)/g) ?? [];
    const pageCounts = countMatches
      .map((match) => Number(match.replace('/Count', '').trim()))
      .filter((count) => Number.isFinite(count) && count > 0 && count < 5000);

    if (pageCounts.length === 0) return 1;
    return Math.max(...pageCounts);
  } catch {
    return 1;
  }
}

async function readCatalogs(
  directory: string,
  buildUrl: (relativePath: string) => string,
  idPrefix: string,
  metadata: Awaited<ReturnType<typeof getPromotionCatalogMetadata>>,
  pageId: string,
  relativeDirectory = ''
): Promise<PromotionCatalog[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) return readCatalogs(absolutePath, buildUrl, idPrefix, metadata, pageId, relativePath);
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.pdf')) return [];

      if ((metadata[relativePath]?.pageId || DEFAULT_CATALOG_PAGE_ID) !== pageId) return [];
      const stats = await fs.stat(absolutePath);
      const pageImages = await renderPromotionCatalog(relativePath).catch(() => []);
      return [{
        id: `${idPrefix}:${relativePath}`,
        name: entry.name.replace(/\.pdf$/i, ''),
        url: buildUrl(relativePath),
        updatedAt: stats.mtime.toISOString(),
        pageCount: await readPdfPageCount(absolutePath),
        pageImages,
        ...metadata[relativePath]
      }];
    })
  );

  return nested.flat();
}

export async function getPromotionCatalogs(pageId: string): Promise<PromotionCatalog[]> {
  const uploadedDir = path.join(getUploadsDir(), 'promotions', 'catalogs');
  const metadata = await getPromotionCatalogMetadata();
  const catalogs = await readCatalogs(
    uploadedDir,
    (relativePath) => buildMediaUrl(['promotions', 'catalogs', ...relativePath.split('/')]),
    'uploaded',
    metadata,
    pageId
  );

  return catalogs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
