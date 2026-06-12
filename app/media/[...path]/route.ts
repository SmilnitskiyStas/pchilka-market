import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';

import { resolveUploadPath, getContentType } from '../../../lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { path: string[] };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { path } = await params;
    const filePath = resolveUploadPath(path);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return new Response('Not found', { status: 404 });
    }

    const contentType = getContentType(filePath);
    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (!match) {
        return new Response('Invalid range', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileStat.size}`
          }
        });
      }

      const start = match[1] ? Number.parseInt(match[1], 10) : 0;
      const end = match[2] ? Number.parseInt(match[2], 10) : fileStat.size - 1;

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start < 0 ||
        end < start ||
        start >= fileStat.size
      ) {
        return new Response('Invalid range', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileStat.size}`
          }
        });
      }

      const safeEnd = Math.min(end, fileStat.size - 1);
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
