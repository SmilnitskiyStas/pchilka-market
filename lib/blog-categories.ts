import type { ContentType } from '@/lib/content-types';

export type BlogCategory = {
  id: string;
  // Legacy single-type field (kept for backward compatibility).
  contentType: ContentType;
  // New multi-type support: one category can target multiple content blocks.
  contentTypes?: ContentType[];
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  postSlugs: string[];
  updatedAt: string;
};

export const BLOG_CATEGORIES_STORAGE_KEY = 'admin_blog_categories_v1';

export const defaultBlogCategories: BlogCategory[] = [
  {
    id: 'blog-cat-news',
    contentType: 'blog',
    contentTypes: ['blog'],
    name: 'Новини мережі',
    slug: 'novyny-merezhi',
    description: 'Оновлення, відкриття магазинів та події мережі.',
    isActive: true,
    sortOrder: 10,
    postSlugs: [],
    updatedAt: ''
  },
  {
    id: 'blog-cat-tips',
    contentType: 'blog',
    contentTypes: ['blog'],
    name: 'Поради покупцям',
    slug: 'porady-pokuptsiam',
    description: 'Корисні поради щодо покупок і вибору товарів.',
    isActive: true,
    sortOrder: 20,
    postSlugs: [],
    updatedAt: ''
  }
];

const allowedContentTypes: ContentType[] = ['blog', 'news', 'charity'];

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

export function normalizeCategorySlug(value: string): string {
  const transliterated = transliterateUkrainian(value.trim().toLowerCase());

  return transliterated
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeContentTypes(rawTypes: unknown, fallbackType: ContentType): ContentType[] {
  if (!Array.isArray(rawTypes)) return [fallbackType];

  const normalized = rawTypes
    .map((item) => String(item))
    .filter((item): item is ContentType => allowedContentTypes.includes(item as ContentType));

  if (normalized.length === 0) return [fallbackType];
  return Array.from(new Set(normalized));
}

export function normalizeCategory(raw: Partial<BlogCategory>): BlogCategory {
  const normalizedType: ContentType = raw.contentType === 'news' || raw.contentType === 'charity' ? raw.contentType : 'blog';
  const normalizedTypes = normalizeContentTypes(raw.contentTypes, normalizedType);

  return {
    id: String(raw.id ?? `blog_cat_${Date.now()}`),
    contentType: normalizedTypes[0],
    contentTypes: normalizedTypes,
    name: String(raw.name ?? '').trim(),
    slug: normalizeCategorySlug(String(raw.slug ?? '')),
    description: String(raw.description ?? '').trim(),
    isActive: Boolean(raw.isActive ?? true),
    sortOrder: Number.isFinite(raw.sortOrder) ? Number(raw.sortOrder) : 100,
    postSlugs: Array.isArray(raw.postSlugs) ? raw.postSlugs.map((item) => String(item)).filter(Boolean) : [],
    updatedAt: String(raw.updatedAt ?? '')
  };
}

export function getCategoryContentTypes(category: BlogCategory): ContentType[] {
  return normalizeContentTypes(category.contentTypes, category.contentType);
}

export function categorySupportsContentType(category: BlogCategory, contentType: ContentType): boolean {
  return getCategoryContentTypes(category).includes(contentType);
}

export function loadBlogCategoriesFromStorage(): BlogCategory[] {
  if (typeof window === 'undefined') return defaultBlogCategories;

  try {
    const raw = window.localStorage.getItem(BLOG_CATEGORIES_STORAGE_KEY);
    if (!raw) return defaultBlogCategories;
    const parsed = JSON.parse(raw) as Partial<BlogCategory>[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultBlogCategories;
    return parsed.map(normalizeCategory);
  } catch {
    return defaultBlogCategories;
  }
}

export function saveBlogCategoriesToStorage(categories: BlogCategory[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BLOG_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
}

