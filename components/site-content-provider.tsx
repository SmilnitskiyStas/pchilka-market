'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { headerMenu } from '@/content/menu';
import { filterContentMenu, dedicatedArticlePages } from '@/lib/menu-content';
import type { ContentEntry } from '@/lib/content-entries';
import PageArticles from '@/components/page-articles';

const empty = { entries: [] as ContentEntry[], populatedPaths: [] as string[], menu: filterContentMenu(headerMenu, new Set<string>()) };
const ContentContext = createContext(empty);
export function useContentMenu() {
  return useContext(ContentContext).menu;
}

export default function SiteContentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [content, setContent] = useState(empty);
  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    const controller = new AbortController();
    const load = () => { void fetch('/api/site/content', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as typeof empty;
      if (!controller.signal.aborted) setContent((previous) => ({ ...previous, entries: payload.entries, populatedPaths: payload.populatedPaths }));
    }).catch(() => {}); };
    const loadMenu = () => { void fetch('/api/site/menu', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { menu: typeof empty.menu };
      if (!controller.signal.aborted) setContent((previous) => ({ ...previous, menu: payload.menu }));
    }).catch(() => {}); };
    const refresh = () => { load(); loadMenu(); };
    refresh();
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); };
  }, [pathname]);
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export function PageAssignedArticles() {
  const pathname = usePathname().replace(/\/+$/, '') || '/';
  const { entries } = useContext(ContentContext);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id.startsWith('article-')) document.getElementById(id)?.scrollIntoView();
  }, [entries, pathname]);
  const articles = entries.filter((entry) => entry.status === 'published' && entry.pagePath === pathname)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  if (!articles.length || dedicatedArticlePages.includes(pathname)) return null;
  return <section aria-label="Статті сторінки" className="site-container space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    <PageArticles articles={articles} />
  </section>;
}
