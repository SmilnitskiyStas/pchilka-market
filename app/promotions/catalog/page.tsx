import { promises as fs } from 'fs';
import path from 'path';
import PromotionCatalogViewer, { type PromotionCatalog } from '@/components/promotion-catalog-viewer';
import { buildMediaUrl, getUploadsDir } from '@/lib/uploads';

// Catalogs are added through the admin panel after deployment, so this page
// must read the file list anew for every request instead of using build output.
export const dynamic = 'force-dynamic';

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
  relativeDirectory = ''
): Promise<PromotionCatalog[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) return readCatalogs(absolutePath, buildUrl, idPrefix, relativePath);
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.pdf')) return [];

      const stats = await fs.stat(absolutePath);
      return [{
        id: `${idPrefix}:${relativePath}`,
        name: entry.name.replace(/\.pdf$/i, ''),
        url: buildUrl(relativePath),
        updatedAt: stats.mtime.toISOString(),
        pageCount: await readPdfPageCount(absolutePath)
      }];
    })
  );

  return nested.flat();
}

async function getPromotionCatalogs(): Promise<PromotionCatalog[]> {
  const uploadedDir = path.join(getUploadsDir(), 'promotions', 'catalogs');
  const catalogs = await readCatalogs(
    uploadedDir,
    (relativePath) => buildMediaUrl(['promotions', 'catalogs', ...relativePath.split('/')]),
    'uploaded'
  );

  return catalogs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export default async function PromotionsCatalogPage() {
  const catalogs = await getPromotionCatalogs();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <PromotionCatalogViewer catalogs={catalogs} />
    </main>
  );
}
