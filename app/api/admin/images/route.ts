import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { buildMediaUrl, getUploadsDir, normalizeUploadFolder } from '@/lib/uploads';

export const runtime = 'nodejs';

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

async function walkImages(dirPath: string, rootPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkImages(absolutePath, rootPath);
      result.push(...nested);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!allowedExtensions.has(ext)) continue;

    const relative = path.relative(rootPath, absolutePath).replace(/\\/g, '/');
    result.push(relative);
  }

  return result;
}

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

async function listPublicImages(): Promise<string[]> {
  const root = path.join(process.cwd(), 'public', 'img');
  const relative = await walkImages(root, root);
  return relative.map((item) => `/img/${item}`);
}

async function listUploadedImages(): Promise<string[]> {
  const uploadsRoot = getUploadsDir();
  const relative = await walkImages(uploadsRoot, uploadsRoot);
  return relative.map(toMediaUrl);
}

export async function GET() {
  try {
    const publicImages = await listPublicImages().catch(() => []);
    const uploadImages = await listUploadedImages().catch(() => []);

    const unique = Array.from(new Set([...publicImages, ...uploadImages]));
    unique.sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ ok: true, images: unique });
  } catch {
    return NextResponse.json({ ok: true, images: [] });
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
    const folderParts = normalizeUploadFolder(folder, 'admin/images');
    const uploadDir = path.join(getUploadsDir(), ...folderParts, year, month);
    await fs.mkdir(uploadDir, { recursive: true });

    const safeBase = normalizeFileName(file.name) || 'image';
    const fileName = `${Date.now()}-${safeBase}${ext}`;
    const absolutePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await fs.writeFile(absolutePath, Buffer.from(bytes));

    return NextResponse.json({ ok: true, path: buildMediaUrl([...folderParts, year, month, fileName]) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
