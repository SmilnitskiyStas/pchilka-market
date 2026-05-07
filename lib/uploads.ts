import path from 'path';

export function getUploadsDir(): string {
  const uploadsDir = process.env.UPLOADS_DIR;
  if (uploadsDir) {
    return path.resolve(uploadsDir);
  }
  return path.resolve(process.cwd(), 'public', 'uploads');
}

export function normalizeUploadFolder(folder: string | null | undefined, fallback = 'misc'): string[] {
  const raw = typeof folder === 'string' ? folder : '';
  const segments = raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      part
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    )
    .filter(Boolean);

  if (segments.length === 0) {
    return [fallback];
  }

  return segments;
}

export function buildMediaUrl(parts: string[]): string {
  const encoded = parts
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `/media/${encoded}`;
}

export function resolveUploadPath(pathParts: string[]): string {
  if (!Array.isArray(pathParts) || pathParts.length === 0) {
    throw new Error('Empty media path');
  }

  const safeParts = pathParts.map((part) => {
    const decoded = decodeURIComponent(part);
    if (!decoded || decoded === '.' || decoded === '..') {
      throw new Error('Invalid media path segment');
    }
    if (decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0')) {
      throw new Error('Unsafe media path segment');
    }
    return decoded;
  });

  const baseDir = getUploadsDir();
  const absolutePath = path.resolve(baseDir, ...safeParts);
  if (absolutePath !== baseDir && !absolutePath.startsWith(baseDir + path.sep)) {
    throw new Error('Path traversal attempt blocked');
  }

  return absolutePath;
}

export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}
