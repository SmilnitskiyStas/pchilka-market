export type SeoRobotsValue = 'index,follow' | 'noindex,nofollow';
export type SitemapChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export type SeoRule = {
  id: string;
  path: string;
  title: string;
  description: string;
  canonical: string;
  robots: SeoRobotsValue;
  includeInSitemap: boolean;
  changeFrequency: SitemapChangeFrequency;
  priority: number;
  updatedAt: string;
};

export type AutoSeoDraft = {
  title: string;
  description: string;
  canonical: string;
  robots: SeoRobotsValue;
};

export const ADMIN_SEO_STORAGE_KEY = 'admin_seo_rules_v1';
export const SEO_RULES_SETTING_KEY = 'seo_rules_v1';
const BRAND_NAME = 'Pchilka Market';

export function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '/';

  const noHash = trimmed.split('#')[0] || '';
  const noQuery = noHash.split('?')[0] || '';
  const withLeading = noQuery.startsWith('/') ? noQuery : `/${noQuery}`;

  if (withLeading.length > 1 && withLeading.endsWith('/')) {
    return withLeading.slice(0, -1);
  }

  return withLeading || '/';
}

export function isValidCanonical(value: string): boolean {
  if (!value) return true;
  return value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
}

function normalizeRobots(value: unknown): SeoRobotsValue {
  return value === 'noindex,nofollow' ? 'noindex,nofollow' : 'index,follow';
}

function normalizeChangeFrequency(value: unknown): SitemapChangeFrequency {
  switch (value) {
    case 'always':
    case 'hourly':
    case 'daily':
    case 'weekly':
    case 'monthly':
    case 'yearly':
    case 'never':
      return value;
    default:
      return 'weekly';
  }
}

function normalizePriority(value: unknown, path: string): number {
  const parsed = Number(value);
  const fallback = path === '/' ? 1 : 0.7;
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return Math.round(parsed * 10) / 10;
}

function toReadablePathTitle(path: string): string {
  if (path === '/') return 'Головна';

  const lastSegment = path.split('/').filter(Boolean).pop() ?? '';
  if (!lastSegment) return 'Сторінка';

  return lastSegment
    .replace(/\[[^\]]+\]/g, 'Сторінка')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function resolveSection(path: string): string {
  if (path === '/') return 'Головна';
  if (path.startsWith('/blog')) return 'Блог';
  if (path.startsWith('/news')) return 'Новини';
  if (path.startsWith('/promotions')) return 'Акції';
  if (path.startsWith('/loyalty')) return 'Програма лояльності';
  if (path.startsWith('/cooperation')) return 'Співпраця';
  if (path.startsWith('/about')) return 'Про мережу';
  if (path.startsWith('/own-brand')) return 'Власне класне';
  if (path.startsWith('/career')) return 'Кар\'єра';
  return 'Сторінка';
}

export function buildAutoSeoDraft(pathInput: string): AutoSeoDraft {
  const path = normalizePath(pathInput);
  const pageTitle = toReadablePathTitle(path);
  const section = resolveSection(path);

  const title = path === '/' ? `${BRAND_NAME} | Головна` : `${pageTitle} | ${section} | ${BRAND_NAME}`;

  const description =
    path === '/'
      ? `Офіційний сайт ${BRAND_NAME}: акції, новини, магазини та програма лояльності.`
      : `Офіційна сторінка «${pageTitle}» мережі ${BRAND_NAME}. Актуальна інформація та пропозиції.`;

  const canonical = path === '/' ? '[domain]/' : `[domain]${path}`;

  return {
    title,
    description,
    canonical,
    robots: 'index,follow'
  };
}

export function normalizeRule(raw: Partial<SeoRule>): SeoRule {
  const path = normalizePath(String(raw.path ?? '/'));

  return {
    id: String(raw.id ?? `seo_${Date.now()}`),
    path,
    title: String(raw.title ?? '').trim(),
    description: String(raw.description ?? '').trim(),
    canonical: String(raw.canonical ?? '').trim(),
    robots: normalizeRobots(raw.robots),
    includeInSitemap: raw.includeInSitemap !== false,
    changeFrequency: normalizeChangeFrequency(raw.changeFrequency),
    priority: normalizePriority(raw.priority, path),
    updatedAt: String(raw.updatedAt ?? '')
  };
}

export function getEffectiveSeo(rule: SeoRule): AutoSeoDraft {
  const auto = buildAutoSeoDraft(rule.path);
  return {
    title: rule.title || auto.title,
    description: rule.description || auto.description,
    canonical: rule.canonical || auto.canonical,
    robots: rule.robots || auto.robots
  };
}

export function parseSeoRulesFromUnknown(raw: unknown): SeoRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => normalizeRule((item ?? {}) as Partial<SeoRule>));
}

export function loadSeoRulesFromStorage(): SeoRule[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(ADMIN_SEO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parseSeoRulesFromUnknown(parsed);
  } catch {
    return [];
  }
}

export function saveSeoRulesToStorage(rules: SeoRule[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADMIN_SEO_STORAGE_KEY, JSON.stringify(rules));
}
