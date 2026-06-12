import { promises as fs } from 'fs';
import path from 'path';

import { getUploadsDir } from '@/lib/uploads';

export const MEDIA_METADATA_FILE_NAME = '.media-metadata.json';

export type MediaAssetMetadata = {
  alt: string;
  title: string;
  caption: string;
  description: string;
  keywords: string;
};

type MediaMetadataStore = Record<string, MediaAssetMetadata>;

const emptyMetadata: MediaAssetMetadata = {
  alt: '',
  title: '',
  caption: '',
  description: '',
  keywords: ''
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMetadata(raw: unknown): MediaAssetMetadata {
  if (!raw || typeof raw !== 'object') {
    return { ...emptyMetadata };
  }

  const source = raw as Record<string, unknown>;
  return {
    alt: normalizeText(source.alt),
    title: normalizeText(source.title),
    caption: normalizeText(source.caption),
    description: normalizeText(source.description),
    keywords: normalizeText(source.keywords)
  };
}

function getMetadataFilePath(): string {
  return path.join(getUploadsDir(), MEDIA_METADATA_FILE_NAME);
}

async function readStore(): Promise<MediaMetadataStore> {
  try {
    const raw = await fs.readFile(getMetadataFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const result: MediaMetadataStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!key.startsWith('/media/')) continue;
      result[key] = normalizeMetadata(value);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('ENOENT')) {
      return {};
    }
    throw error;
  }
}

async function writeStore(store: MediaMetadataStore): Promise<void> {
  await fs.mkdir(getUploadsDir(), { recursive: true });
  await fs.writeFile(getMetadataFilePath(), JSON.stringify(store, null, 2), 'utf8');
}

export function getDefaultMediaMetadata(assetUrl: string): MediaAssetMetadata {
  const fileName = assetUrl.split('/').filter(Boolean).pop() ?? '';
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/^\d+-/, '');
  const humanTitle = baseName
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return {
    ...emptyMetadata,
    title: humanTitle
  };
}

export async function getMediaMetadataMap(): Promise<MediaMetadataStore> {
  return readStore();
}

export async function getMediaMetadata(assetUrl: string): Promise<MediaAssetMetadata> {
  const store = await readStore();
  return store[assetUrl] ? normalizeMetadata(store[assetUrl]) : getDefaultMediaMetadata(assetUrl);
}

export async function upsertMediaMetadata(assetUrl: string, metadata: Partial<MediaAssetMetadata>): Promise<MediaAssetMetadata> {
  const store = await readStore();
  const current = store[assetUrl] ? normalizeMetadata(store[assetUrl]) : getDefaultMediaMetadata(assetUrl);
  const next = normalizeMetadata({ ...current, ...metadata });
  store[assetUrl] = next;
  await writeStore(store);
  return next;
}

export async function removeMediaMetadata(assetUrl: string): Promise<void> {
  const store = await readStore();
  if (assetUrl in store) {
    delete store[assetUrl];
    await writeStore(store);
  }
}
