import { promises as fs } from 'fs';
import path from 'path';
import PromotionCatalogViewer, { type PromotionCatalog } from '@/components/promotion-catalog-viewer';

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

async function getPromotionCatalogs(): Promise<PromotionCatalog[]> {
  const catalogsDir = path.join(process.cwd(), 'public', 'pdf', 'promotions');

  let entries: Awaited<ReturnType<typeof fs.readdir>> = [];
  try {
    entries = await fs.readdir(catalogsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
      .map(async (entry) => {
        const absolutePath = path.join(catalogsDir, entry.name);
        const stats = await fs.stat(absolutePath);
        const pageCount = await readPdfPageCount(absolutePath);

        return {
          id: entry.name,
          name: entry.name.replace(/\.pdf$/i, ''),
          url: `/pdf/promotions/${encodeURIComponent(entry.name)}`,
          updatedAt: stats.mtime.toISOString(),
          pageCount
        };
      })
  );

  return files.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export default async function PromotionsCatalogPage() {
  const catalogs = await getPromotionCatalogs();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <PromotionCatalogViewer catalogs={catalogs} />
    </main>
  );
}
