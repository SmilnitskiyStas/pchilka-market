import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  getDefaultMediaMetadata,
  type MediaAssetMetadata,
  getMediaMetadataMap,
  MEDIA_METADATA_FILE_NAME,
  removeMediaMetadata,
  upsertMediaMetadata
} from '@/lib/media-asset-metadata';
import { buildMediaUrl, getUploadsDir, normalizeUploadFolder, resolveUploadPath } from '@/lib/uploads';

export const runtime = 'nodejs';

const allowedExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.svg',
  '.pdf',
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.json'
]);

async function walkAssets(dirPath: string, rootPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkAssets(absolutePath, rootPath);
      result.push(...nested);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!allowedExtensions.has(ext)) continue;
    if (entry.name === MEDIA_METADATA_FILE_NAME) continue;

    result.push(path.relative(rootPath, absolutePath).replace(/\\/g, '/'));
  }

  return result;
}

function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function toMediaUrl(relativePath: string): string {
  return buildMediaUrl(relativePath.split('/'));
}

export async function GET() {
  try {
    const uploadsRoot = getUploadsDir();
    const relative = await walkAssets(uploadsRoot, uploadsRoot).catch(() => []);
    const metadataMap: Record<string, MediaAssetMetadata> = await getMediaMetadataMap().catch(() => ({}));
    const assets = relative
      .map((item) => {
        const url = toMediaUrl(item);
        return {
          url,
          metadata: metadataMap[url] ?? getDefaultMediaMetadata(url)
        };
      })
      .sort((a, b) => a.url.localeCompare(b.url));
    return NextResponse.json({ ok: true, assets });
  } catch {
    return NextResponse.json({ ok: true, assets: [] });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folderRaw = formData.get('folder');
    const folder = typeof folderRaw === 'string' ? folderRaw : '';

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Файл не передано.' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      return NextResponse.json({ ok: false, error: 'Непідтримуваний формат файлу.' }, { status: 400 });
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const folderParts = normalizeUploadFolder(folder, 'content/misc');
    const uploadDir = path.join(getUploadsDir(), ...folderParts, year, month);
    await fs.mkdir(uploadDir, { recursive: true });

    const safeBase = normalizeFileName(file.name) || 'asset';
    const fileName = `${Date.now()}-${safeBase}${ext}`;
    const absolutePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await fs.writeFile(absolutePath, Buffer.from(bytes));

    const mediaUrl = buildMediaUrl([...folderParts, year, month, fileName]);
    await upsertMediaMetadata(mediaUrl, {});

    return NextResponse.json({
      ok: true,
      path: mediaUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const payload = (await request.json()) as { path?: string };
    const assetPath = typeof payload.path === 'string' ? payload.path.trim() : '';

    if (!assetPath.startsWith('/media/')) {
      return NextResponse.json({ ok: false, error: 'Некоректний шлях до файлу.' }, { status: 400 });
    }

    const relativePath = assetPath.replace(/^\/media\//, '');
    const pathParts = relativePath.split('/').filter(Boolean);
    const absolutePath = resolveUploadPath(pathParts);
    const stat = await fs.stat(absolutePath);

    if (!stat.isFile()) {
      return NextResponse.json({ ok: false, error: 'Можна видаляти лише файли.' }, { status: 400 });
    }

    await fs.unlink(absolutePath);
    await removeMediaMetadata(assetPath);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown delete error';
    const status = message.includes('ENOENT') ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const payload = (await request.json()) as {
      path?: string;
      metadata?: {
        alt?: string;
        title?: string;
        caption?: string;
        description?: string;
        keywords?: string;
      };
    };

    const assetPath = typeof payload.path === 'string' ? payload.path.trim() : '';
    if (!assetPath.startsWith('/media/')) {
      return NextResponse.json({ ok: false, error: 'Некоректний шлях до файлу.' }, { status: 400 });
    }

    const relativePath = assetPath.replace(/^\/media\//, '');
    const pathParts = relativePath.split('/').filter(Boolean);
    const absolutePath = resolveUploadPath(pathParts);
    const stat = await fs.stat(absolutePath);

    if (!stat.isFile()) {
      return NextResponse.json({ ok: false, error: 'Файл не знайдено.' }, { status: 404 });
    }

    const metadata = await upsertMediaMetadata(assetPath, payload.metadata ?? {});
    return NextResponse.json({ ok: true, metadata });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown metadata update error';
    const status = message.includes('ENOENT') ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
