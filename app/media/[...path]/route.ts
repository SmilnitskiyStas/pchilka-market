import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';

import { resolveUploadPath, getContentType } from '../../../lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { path: string[] };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { path } = await params;
    const filePath = resolveUploadPath(path);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return new Response('Not found', { status: 404 });
    }

    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': getContentType(filePath),
        'Content-Length': String(fileStat.size),
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
