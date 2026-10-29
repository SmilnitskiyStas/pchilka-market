'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { fetchPublicSiteData } from '@/lib/public-site-data-client';

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

async function fetchSeoRule(path: string, force = false): Promise<SeoRule | null> {
  const payload = await fetchPublicSiteData<{ ok?: boolean; rules?: unknown }>('/api/admin/seo/rules', force);
  if (!payload.ok) return null;

  const rules = parseSeoRulesFromUnknown(payload.rules);
  return rules.find((item) => item.path === path) ?? null;
}

export default function SeoRuntimeLoader() {
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    const normalizedPath = normalizePath(pathname ?? '/');

    async function applySeo(force = false) {
      removeManagedTags();
      if (normalizedPath.startsWith('/admin') || normalizedPath === '/login' || normalizedPath.startsWith('/pages/') || (normalizedPath === '/cooperation/rental' && (new URLSearchParams(window.location.search).has('preview') || document.querySelector('meta[name="pchilka-visual-seo"]')))) return;

      const rule = await fetchSeoRule(normalizedPath, force);
      if (controller.signal.aborted || !rule) return;

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

    const refresh = () => { void applySeo(true).catch(() => {}); };
    void applySeo().catch(() => {});
    window.addEventListener('focus', refresh);

    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
      removeManagedTags();
    };
  }, [pathname]);

  return null;
}
