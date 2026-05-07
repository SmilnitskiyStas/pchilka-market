'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import {
  getEffectiveSeo,
  normalizePath,
  parseSeoRulesFromUnknown,
  type SeoRule
} from '@/lib/seo-settings';

const META_DESCRIPTION_ID = 'admin-seo-meta-description';
const META_ROBOTS_ID = 'admin-seo-meta-robots';
const CANONICAL_ID = 'admin-seo-link-canonical';

function removeManagedTags() {
  document.getElementById(META_DESCRIPTION_ID)?.remove();
  document.getElementById(META_ROBOTS_ID)?.remove();
  document.getElementById(CANONICAL_ID)?.remove();
}

function upsertMeta(id: string, name: string, content: string) {
  let meta = document.getElementById(id) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.id = id;
    meta.name = name;
    document.head.appendChild(meta);
  }

  meta.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let link = document.getElementById(CANONICAL_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = CANONICAL_ID;
    link.rel = 'canonical';
    document.head.appendChild(link);
  }

  link.href = href;
}

function toAbsoluteCanonical(value: string, currentPath: string) {
  if (!value) return `${window.location.origin}${currentPath}`;

  const replacedToken = value.replace('[domain]', window.location.origin);
  if (replacedToken.startsWith('http://') || replacedToken.startsWith('https://')) return replacedToken;
  if (replacedToken.startsWith('/')) return `${window.location.origin}${normalizePath(replacedToken)}`;

  return `${window.location.origin}${currentPath}`;
}

async function fetchSeoRule(path: string, signal?: AbortSignal): Promise<SeoRule | null> {
  const response = await fetch('/api/admin/seo/rules', {
    cache: 'no-store',
    signal
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as { ok?: boolean; rules?: unknown };
  if (!payload.ok) return null;

  const rules = parseSeoRulesFromUnknown(payload.rules);
  return rules.find((item) => item.path === path) ?? null;
}

export default function SeoRuntimeLoader() {
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    const normalizedPath = normalizePath(pathname ?? '/');

    async function applySeo() {
      removeManagedTags();

      const rule = await fetchSeoRule(normalizedPath, controller.signal);
      if (!rule) return;

      const effective = getEffectiveSeo(rule);

      if (effective.title) {
        document.title = effective.title;
      }

      if (effective.description) {
        upsertMeta(META_DESCRIPTION_ID, 'description', effective.description);
      }

      if (effective.robots) {
        upsertMeta(META_ROBOTS_ID, 'robots', effective.robots);
      }

      upsertCanonical(toAbsoluteCanonical(effective.canonical, normalizedPath));
    }

    void applySeo();

    return () => {
      controller.abort();
      removeManagedTags();
    };
  }, [pathname]);

  return null;
}
