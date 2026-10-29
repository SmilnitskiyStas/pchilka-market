'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { headerMenu } from '@/content/menu';
import { filterContentMenu, dedicatedArticlePages } from '@/lib/menu-content';
import type { ContentEntry, ContentPlacement } from '@/lib/content-entries';
import PageArticles from '@/components/page-articles';
import { clearPublicSiteData, fetchPublicSiteData } from '@/lib/public-site-data-client';

const empty = { entries: [] as ContentEntry[], populatedPaths: [] as string[], menu: filterContentMenu(headerMenu, new Set<string>()) };
const ContentContext = createContext(empty);
export function useContentMenu() {
  return useContext(ContentContext).menu;
}

export default function SiteContentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [content, setContent] = useState(empty);
  useEffect(() => {
    if (pathname.startsWith('/admin')) { clearPublicSiteData(); return; }
    let cancelled = false;
    const load = (force = false) => { void fetchPublicSiteData<typeof empty>('/api/site/content', force).then((payload) => {
      if (!cancelled) setContent((previous) => ({ ...previous, entries: payload.entries, populatedPaths: payload.populatedPaths }));
    }).catch(() => {}); };
    const loadMenu = (force = false) => { void fetchPublicSiteData<{ menu: typeof empty.menu }>('/api/site/menu', force).then((payload) => {
      if (!cancelled) setContent((previous) => ({ ...previous, menu: payload.menu }));
    }).catch(() => {}); };
    const refresh = () => { load(true); loadMenu(true); };
    load(); loadMenu();
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; window.removeEventListener('focus', refresh); };
  }, [pathname]);
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export function PageAssignedArticles({ placement = 'after-content' }: { placement?: ContentPlacement }) {
  const pathname = usePathname().replace(/\/+$/, '') || '/';
  const { entries } = useContext(ContentContext);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id.startsWith('article-')) document.getElementById(id)?.scrollIntoView();
  }, [entries, pathname]);
  const articles = entries.filter((entry) => entry.status === 'published' && entry.pagePath === pathname && (entry.placement || 'after-content') === placement)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  if (!articles.length || dedicatedArticlePages.includes(pathname)) return null;
  return <section aria-label="Статті сторінки" className="site-container space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    <PageArticles articles={articles} />
  </section>;
}
