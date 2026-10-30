import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { buildMediaUrl, getUploadsDir, normalizeUploadFolder } from '@/lib/uploads';
import { startVideoOptimization } from '@/lib/video-optimization';
import { isOptimizableVideo } from '@/lib/video-optimization-types';
import { randomUUID } from 'crypto';
import { listMediaFiles } from '@/lib/media-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The route is also used by the homepage banner manager. Keep this allow-list
// intentionally narrow: videos are limited to browser-friendly formats.
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.mp4', '.webm']);

function toMediaUrl(relativePath: string): string {
  return buildMediaUrl(relativePath.split('/'));
}

function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export async function GET() {
  const [uploaded, bundled] = await Promise.all([
    listMediaFiles(getUploadsDir(), allowedExtensions, toMediaUrl).catch(() => []),
    listMediaFiles(path.join(process.cwd(), 'public', 'img'), allowedExtensions, item => `/img/${item}`).catch(() => [])
  ]);
  // Admin uploads precede bundled artwork, whose mtime changes with deployment.
  const images = Array.from(new Set([...uploaded, ...bundled].map(item => item.url)));
  return NextResponse.json({ ok: true, images }, { headers: { 'Cache-Control': 'no-store' } });
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
    const folderParts = normalizeUploadFolder(folder, 'admin/images');
    const uploadDir = path.join(getUploadsDir(), ...folderParts, year, month);
    await fs.mkdir(uploadDir, { recursive: true });

    const safeBase = normalizeFileName(file.name) || 'image';
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBase}${ext}`;
    const absolutePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await fs.writeFile(absolutePath, Buffer.from(bytes));

    const mediaUrl = buildMediaUrl([...folderParts, year, month, fileName]);
    if (optimizeVideo) {
      try { return NextResponse.json({ ok: true, path: mediaUrl, optimization: await startVideoOptimization(mediaUrl, keepOriginal) }); }
      catch { return NextResponse.json({ ok: true, path: mediaUrl, warning: 'Відео завантажено, але оптимізацію не запущено. Оригінал збережено; запустіть обробку в медіафайлах.' }); }
    }
    return NextResponse.json({ ok: true, path: mediaUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
