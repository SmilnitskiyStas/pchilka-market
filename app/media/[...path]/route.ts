import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';

import { resolveUploadPath, getContentType } from '../../../lib/uploads';
import { parseByteRange } from '@/lib/http-byte-range';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { path: string[] };

async function serveMedia(
  request: Request,
  { params }: { params: Promise<Params> },
  headOnly = false
) {
  try {
    const { path } = await params;
    const filePath = resolveUploadPath(path);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return new Response('Not found', { status: 404 });
    }

    const contentType = getContentType(filePath);
    if (headOnly) return new Response(null, { headers: { 'Content-Type': contentType, 'Content-Length': String(fileStat.size), 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' } });
    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
      const range = parseByteRange(rangeHeader, fileStat.size);
      if (!range) {
        return new Response('Invalid range', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileStat.size}`
          }
        });
      }

      const { start, end: safeEnd } = range;
      const chunkSize = safeEnd - start + 1;
      const partialStream = createReadStream(filePath, { start, end: safeEnd });
      const partialWebStream = Readable.toWeb(partialStream) as ReadableStream;

      return new Response(partialWebStream, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${safeEnd}/${fileStat.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileStat.size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown media error';
    if (
      message.includes('ENOENT') ||
      message.includes('Invalid media path segment') ||
      message.includes('Path traversal attempt blocked')
    ) {
      return new Response('Not found', { status: 404 });
    }
    return new Response('Media error', { status: 500 });
  }
}

export function GET(request: Request, context: { params: Promise<Params> }) { return serveMedia(request, context); }
export function HEAD(request: Request, context: { params: Promise<Params> }) { return serveMedia(request, context, true); }
