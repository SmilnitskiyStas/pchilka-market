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
import { startVideoOptimization, isVideoOptimizationActive } from '@/lib/video-optimization';
import { isOptimizableVideo } from '@/lib/video-optimization-types';
import { randomUUID } from 'crypto';
import { listMediaFiles } from '@/lib/media-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const files = await listMediaFiles(uploadsRoot, allowedExtensions, toMediaUrl, [MEDIA_METADATA_FILE_NAME]).catch(() => []);
    const metadataMap: Record<string, MediaAssetMetadata> = await getMediaMetadataMap().catch(() => ({}));
    const assets = files.map(({ url }) => ({
      url,
      metadata: metadataMap[url] ?? getDefaultMediaMetadata(url)
    }));
    return NextResponse.json({ ok: true, assets }, { headers: { 'Cache-Control': 'no-store' } });
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
    const optimizeVideo = formData.get('optimizeVideo') === 'true' && isOptimizableVideo(file.name);
    const keepOriginal = formData.get('keepOriginal') !== 'false';
    if (optimizeVideo && !keepOriginal && !isAdminRequestAuthorized(new Request(request.url, { method: 'DELETE', headers: request.headers }))) return unauthorizedAdminResponse();
    if (optimizeVideo && file.size > 512 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Для оптимізації оберіть відео до 512 МБ.' }, { status: 400 });
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
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBase}${ext}`;
    const absolutePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await fs.writeFile(absolutePath, Buffer.from(bytes));

    const mediaUrl = buildMediaUrl([...folderParts, year, month, fileName]);
    await upsertMediaMetadata(mediaUrl, {});

    if (optimizeVideo) {
      try { return NextResponse.json({ ok: true, path: mediaUrl, optimization: await startVideoOptimization(mediaUrl, keepOriginal) }); }
      catch { return NextResponse.json({ ok: true, path: mediaUrl, warning: 'Відео завантажено, але оптимізацію не запущено. Оригінал збережено; запустіть обробку в медіафайлах.' }); }
    }
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
    if (isVideoOptimizationActive(assetPath)) return NextResponse.json({ ok: false, error: 'Відео зараз обробляється. Дочекайтеся завершення оптимізації.' }, { status: 409 });

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
