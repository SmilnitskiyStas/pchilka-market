import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  getPromotionCatalogMetadata,
  removePromotionCatalogMetadata,
  savePromotionCatalogMetadata,
  type PromotionCatalogMetadata
} from '@/lib/promotion-catalog-metadata';
import { buildMediaUrl, getUploadsDir, resolveUploadPath } from '@/lib/uploads';

export const runtime = 'nodejs';

type CatalogFile = PromotionCatalogMetadata & {
  id: string;
  name: string;
  url: string;
  updatedAt: string;
  pageCount: number;
};

const CATALOG_FOLDER = ['promotions', 'catalogs'];

function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

async function readPdfPageCount(absolutePath: string): Promise<number> {
  try {
    const content = (await fs.readFile(absolutePath)).toString('latin1');
    const matches = content.match(/\/Count\s+(\d+)/g) ?? [];
    const pageCounts = matches
      .map((match) => Number(match.replace('/Count', '').trim()))
      .filter((count) => Number.isFinite(count) && count > 0 && count < 5000);

    return pageCounts.length > 0 ? Math.max(...pageCounts) : 1;
  } catch {
    return 1;
  }
}

async function walkCatalogs(
  directory: string,
  metadata: Record<string, PromotionCatalogMetadata>,
  relativeDirectory = ''
): Promise<CatalogFile[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const catalogs = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) return walkCatalogs(absolutePath, metadata, relativePath);
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.pdf') return [];

      const stats = await fs.stat(absolutePath);
      return [
        {
          id: relativePath,
          name: entry.name.replace(/\.pdf$/i, ''),
          url: buildMediaUrl([...CATALOG_FOLDER, ...relativePath.split('/')]),
          updatedAt: stats.mtime.toISOString(),
          pageCount: await readPdfPageCount(absolutePath),
          ...metadata[relativePath]
        }
      ];
    })
  );

  return catalogs.flat();
}

async function listCatalogs(): Promise<CatalogFile[]> {
  const directory = path.join(getUploadsDir(), ...CATALOG_FOLDER);
  const metadata = await getPromotionCatalogMetadata();
  const catalogs = await walkCatalogs(directory, metadata);
  return catalogs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  return NextResponse.json({ ok: true, catalogs: await listCatalogs() });
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const formData = await request.formData();
    const metadata: PromotionCatalogMetadata = {
      title: String(formData.get('title') ?? ''),
      seoTitle: String(formData.get('seoTitle') ?? ''),
      seoDescription: String(formData.get('seoDescription') ?? ''),
      seoKeywords: String(formData.get('seoKeywords') ?? '')
    };
    const sourcePath = formData.get('sourcePath');
    const file = formData.get('file');
    let sourceFileName = '';
    let sourceFilePath = '';

    if (typeof sourcePath === 'string' && sourcePath.startsWith('/media/')) {
      const sourceParts = sourcePath.replace(/^\/media\//, '').split('/').filter(Boolean);
      sourceFileName = sourceParts.at(-1) ?? '';
      if (path.extname(sourceFileName).toLowerCase() !== '.pdf') {
        return NextResponse.json({ ok: false, error: 'Оберіть PDF-файл із медіафайлів.' }, { status: 400 });
      }
      sourceFilePath = resolveUploadPath(sourceParts);
      if (!(await fs.stat(sourceFilePath)).isFile()) {
        return NextResponse.json({ ok: false, error: 'Файл у медіафайлах не знайдено.' }, { status: 404 });
      }
    } else if (file instanceof File && path.extname(file.name).toLowerCase() === '.pdf') {
      sourceFileName = file.name;
    } else {
      return NextResponse.json({ ok: false, error: 'Оберіть PDF-файл каталогу.' }, { status: 400 });
    }

    const fileName = `${Date.now()}-${normalizeFileName(sourceFileName) || 'catalog'}.pdf`;
    const targetPath = resolveUploadPath([...CATALOG_FOLDER, year, month, fileName]);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    if (sourceFilePath) {
      await fs.copyFile(sourceFilePath, targetPath);
    } else if (file instanceof File) {
      await fs.writeFile(targetPath, Buffer.from(await file.arrayBuffer()));
    }
    await savePromotionCatalogMetadata(`${year}/${month}/${fileName}`, metadata);

    return NextResponse.json({ ok: true, catalogs: await listCatalogs() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося завантажити каталог.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const { id } = (await request.json()) as { id?: string };
    const relativePath = typeof id === 'string' ? id.split('/').filter(Boolean) : [];
    if (relativePath.length === 0 || relativePath.some((part) => part === '.' || part === '..') || path.extname(relativePath.at(-1) ?? '').toLowerCase() !== '.pdf') {
      return NextResponse.json({ ok: false, error: 'Некоректний каталог.' }, { status: 400 });
    }

    await fs.unlink(resolveUploadPath([...CATALOG_FOLDER, ...relativePath]));
    await removePromotionCatalogMetadata(relativePath.join('/'));
    return NextResponse.json({ ok: true, catalogs: await listCatalogs() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося видалити каталог.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const { id, metadata } = (await request.json()) as { id?: string; metadata?: PromotionCatalogMetadata };
    const relativePath = typeof id === 'string' ? id.split('/').filter(Boolean) : [];
    if (relativePath.length === 0 || path.extname(relativePath.at(-1) ?? '').toLowerCase() !== '.pdf') {
      return NextResponse.json({ ok: false, error: 'Некоректний каталог.' }, { status: 400 });
    }

    const file = await fs.stat(resolveUploadPath([...CATALOG_FOLDER, ...relativePath]));
    if (!file.isFile()) return NextResponse.json({ ok: false, error: 'Каталог не знайдено.' }, { status: 404 });
    await savePromotionCatalogMetadata(relativePath.join('/'), metadata ?? {});
    return NextResponse.json({ ok: true, catalogs: await listCatalogs() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося зберегти дані каталогу.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
