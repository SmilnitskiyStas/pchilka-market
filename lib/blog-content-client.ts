import type { BlogCategory } from '@/lib/blog-categories';
import { normalizeCategory } from '@/lib/blog-categories';
import type { ContentEntry } from '@/lib/content-entries';
import { normalizeContentEntry } from '@/lib/content-entries';

export type BlogContentPayload = {
  entries: ContentEntry[];
  categories: BlogCategory[];
};

export async function fetchBlogContentPayload(): Promise<BlogContentPayload> {
  const response = await fetch('/api/admin/blog/content', { cache: 'no-store' });
  const payload = (await response.json()) as {
    ok?: boolean;
    entries?: Partial<ContentEntry>[];
    categories?: Partial<BlogCategory>[];
    error?: string;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося завантажити контент блогу з БД.');
  }

  return {
    entries: Array.isArray(payload.entries) ? payload.entries.map((item) => normalizeContentEntry(item ?? {})) : [],
    categories: Array.isArray(payload.categories) ? payload.categories.map((item) => normalizeCategory(item ?? {})) : []
  };
}

export async function saveBlogContentPayload(payload: BlogContentPayload): Promise<BlogContentPayload> {
  const response = await fetch('/api/admin/blog/content', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as {
    ok?: boolean;
    entries?: Partial<ContentEntry>[];
    categories?: Partial<BlogCategory>[];
    error?: string;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Не вдалося зберегти контент блогу в БД.');
  }

  return {
    entries: Array.isArray(data.entries) ? data.entries.map((item) => normalizeContentEntry(item ?? {})) : [],
    categories: Array.isArray(data.categories) ? data.categories.map((item) => normalizeCategory(item ?? {})) : []
  };
}
