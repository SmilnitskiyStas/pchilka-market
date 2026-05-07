import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { NextResponse } from 'next/server';

import { buildMediaUrl, getUploadsDir, normalizeUploadFolder } from '@/lib/uploads';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt']);

function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folderRaw = formData.get('folder');
    const folder = typeof folderRaw === 'string' ? folderRaw : '';

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Файл не передано.' }, { status: 400 });
    }

    const extension = getFileExtension(file.name);
    if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
      return NextResponse.json({ ok: false, error: 'Недозволений формат файлу.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ ok: false, error: 'Файл завеликий. Максимум 10MB.' }, { status: 400 });
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const folderParts = normalizeUploadFolder(folder, 'forms');
    const uploadsRoot = path.join(getUploadsDir(), ...folderParts, year, month);
    await mkdir(uploadsRoot, { recursive: true });

    const safeExtension = extension || 'bin';
    const storedFileName = `${Date.now()}-${randomUUID().slice(0, 8)}.${safeExtension}`;
    const absolutePath = path.join(uploadsRoot, storedFileName);

    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, bytes);

    const publicUrl = buildMediaUrl([...folderParts, year, month, storedFileName]);

    return NextResponse.json({
      ok: true,
      attachment: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        lastModified: file.lastModified,
        url: publicUrl
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
