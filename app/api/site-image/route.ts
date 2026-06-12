import { promises as fs } from 'fs';
import path from 'path';

import { getContentType, resolveUploadPath } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function decodeRef(ref: string): string {
  return Buffer.from(ref, 'base64url').toString('utf8');
}

function resolvePublicPath(src: string): string {
  const normalized = src.replace(/\\/g, '/');
  if (!normalized.startsWith('/img/')) {
    throw new Error('Unsupported public asset path');
  }

  const relativePath = normalized.replace(/^\/+/, '');
  const parts = relativePath.split('/').filter(Boolean);
  const baseDir = path.join(process.cwd(), 'public');
  const absolutePath = path.resolve(baseDir, ...parts);

  if (absolutePath !== baseDir && !absolutePath.startsWith(baseDir + path.sep)) {
    throw new Error('Path traversal attempt blocked');
  }

  return absolutePath;
}

async function readLocalAsset(src: string): Promise<Response> {
  const absolutePath = src.startsWith('/media/')
    ? resolveUploadPath(src.replace(/^\/media\//, '').split('/').filter(Boolean))
    : resolvePublicPath(src);

  const buffer = await fs.readFile(absolutePath);

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': getContentType(absolutePath),
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ref = searchParams.get('ref')?.trim() ?? '';

    if (!ref) {
      return new Response('Missing image ref', { status: 400 });
    }

    const src = decodeRef(ref);
    if (!src) {
      return new Response('Invalid image ref', { status: 400 });
    }

    if (src.startsWith('/media/') || src.startsWith('/img/')) {
      return readLocalAsset(src);
    }

    if (src.startsWith('http://') || src.startsWith('https://')) {
      const upstream = await fetch(src, { cache: 'no-store' });
      if (!upstream.ok) {
        return new Response('Upstream image error', { status: upstream.status });
      }

      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    return new Response('Unsupported image source', { status: 400 });
  } catch {
    return new Response('Image proxy error', { status: 500 });
  }
}
