'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { headerMenu } from '@/content/menu';
import { filterContentMenu } from '@/lib/menu-content';
import type { ContentEntry } from '@/lib/content-entries';
import ArticleBody from '@/components/article-body';

const empty = { entries: [] as ContentEntry[], populatedPaths: [] as string[] };
const ContentContext = createContext(empty);
export function useContentMenu() {
  const { populatedPaths } = useContext(ContentContext);
  return filterContentMenu(headerMenu, new Set(populatedPaths));
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
      if (!controller.signal.aborted) setContent(payload);
    }).catch(() => {}); };
    load();
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.removeEventListener('focus', load); };
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
  if (!articles.length) return null;
  return <section aria-label="Статті сторінки" className="site-container space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    {articles.map((entry) => <article id={`article-${entry.slug}`} key={entry.id} className="scroll-mt-28 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <img src={entry.coverImage} alt={entry.title} className="max-h-96 w-full object-cover" />
      <div className="p-6 sm:p-8"><h2 className="text-3xl font-bold text-slate-900">{entry.title}</h2><p className="mt-3 text-slate-600">{entry.excerpt}</p><ArticleBody body={entry.body} /></div>
    </article>)}
  </section>;
}
