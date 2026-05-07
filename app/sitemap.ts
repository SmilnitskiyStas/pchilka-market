import type { MetadataRoute } from 'next';

import { mainMenu } from '@/content/menu';
import { getSeoRulesFromDb } from '@/lib/seo-rules-repository';

export const runtime = 'nodejs';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://pchilka-market.ua';

function toAbsoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

function collectMenuPaths(): string[] {
  const values = new Set<string>();

  const visit = (items: typeof mainMenu) => {
    items.forEach((item) => {
      if (item.href && item.href !== '#') values.add(item.href);
      if (item.children?.length) visit(item.children);
    });
  };

  visit(mainMenu);
  values.add('/');

  return Array.from(values);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fallback: MetadataRoute.Sitemap = collectMenuPaths().map((path) => ({
    url: toAbsoluteUrl(path),
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.7
  }));

  try {
    const rules = await getSeoRulesFromDb();
    if (rules.length === 0) return fallback;

    const fromRules: MetadataRoute.Sitemap = rules
      .filter((rule) => rule.includeInSitemap && rule.robots !== 'noindex,nofollow')
      .map((rule) => ({
        url: toAbsoluteUrl(rule.path),
        lastModified: rule.updatedAt ? new Date(rule.updatedAt) : new Date(),
        changeFrequency: rule.changeFrequency,
        priority: rule.priority
      }));

    if (fromRules.length === 0) return fallback;

    const deduped = new Map<string, MetadataRoute.Sitemap[number]>();

    [...fallback, ...fromRules].forEach((item) => {
      deduped.set(item.url, item);
    });

    return Array.from(deduped.values()).sort((a, b) => a.url.localeCompare(b.url));
  } catch {
    return fallback;
  }
}
