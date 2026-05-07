import type { ContentEntry } from '@/lib/content-entries';
import type { ContentType } from '@/lib/content-types';

import { getBlogContentFromDb } from '@/lib/blog-content-repository';

function toTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export async function listPublishedEntriesByType(contentType: ContentType): Promise<ContentEntry[]> {
  const payload = await getBlogContentFromDb();
  return payload.entries
    .filter((entry) => entry.contentType === contentType && entry.status === 'published')
    .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt));
}

export async function getPublishedEntryByTypeAndSlug(
  contentType: ContentType,
  slug: string
): Promise<ContentEntry | null> {
  const list = await listPublishedEntriesByType(contentType);
  return list.find((item) => item.slug === slug) ?? null;
}

