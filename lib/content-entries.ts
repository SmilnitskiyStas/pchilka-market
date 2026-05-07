import type { ContentType } from '@/lib/content-types';

export type ContentEntry = {
  id: string;
  contentType: ContentType;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  categoryIds: string[];
  coverImage: string;
  status: 'draft' | 'published';
  updatedAt: string;
};

export const CONTENT_ENTRIES_STORAGE_KEY = 'admin_content_entries_v1';

const ukToLatMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'shch', ь: '', ю: 'yu', я: 'ya', "'": '', '’': '', '`': '', 'ʼ': ''
};

function transliterateUkrainian(input: string): string {
  return input
    .split('')
    .map((char) => ukToLatMap[char] ?? char)
    .join('');
}

export function normalizeSlug(value: string): string {
  const transliterated = transliterateUkrainian(value.trim().toLowerCase());

  return transliterated
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeContentEntry(raw: Partial<ContentEntry>): ContentEntry {
  const normalizedType: ContentType = raw.contentType === 'news' || raw.contentType === 'charity' ? raw.contentType : 'blog';
  const normalizedStatus = raw.status === 'published' ? 'published' : 'draft';

  return {
    id: String(raw.id ?? `content_${Date.now()}`),
    contentType: normalizedType,
    title: String(raw.title ?? '').trim(),
    slug: normalizeSlug(String(raw.slug ?? '')),
    excerpt: String(raw.excerpt ?? '').trim(),
    body: String(raw.body ?? '').trim(),
    categoryIds: Array.isArray(raw.categoryIds) ? raw.categoryIds.map((item) => String(item)).filter(Boolean) : [],
    coverImage: String(raw.coverImage ?? '').trim(),
    status: normalizedStatus,
    updatedAt: String(raw.updatedAt ?? '')
  };
}

export function loadContentEntriesFromStorage(): ContentEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(CONTENT_ENTRIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<ContentEntry>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeContentEntry);
  } catch {
    return [];
  }
}

export function saveContentEntriesToStorage(entries: ContentEntry[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONTENT_ENTRIES_STORAGE_KEY, JSON.stringify(entries));
}
