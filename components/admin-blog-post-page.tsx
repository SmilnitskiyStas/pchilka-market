'use client';

import Link from 'next/link';
import ArticleBody from '@/components/article-body';
import { useEffect, useMemo, useState } from 'react';

import BlogEngagement from '@/components/blog-engagement';
import { categorySupportsContentType, type BlogCategory } from '@/lib/blog-categories';
import type { ContentEntry } from '@/lib/content-entries';
import { fetchBlogContentPayload } from '@/lib/blog-content-client';

type AdminBlogPostPageProps = {
  slug: string;
};

export default function AdminBlogPostPage({ slug }: AdminBlogPostPageProps) {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const payload = await fetchBlogContentPayload();
        if (cancelled) return;
        setEntries(payload.entries);
        setCategories(payload.categories);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const entry = useMemo(
    () => entries.find((item) => !item.pagePath && item.contentType === 'blog' && item.status === 'published' && item.slug === slug),
    [entries, slug]
  );

  const categoryNames = useMemo(() => {
    if (!entry) return [];
    const map = new Map(categories.filter((cat) => categorySupportsContentType(cat, 'blog')).map((cat) => [cat.id, cat.name]));
    return entry.categoryIds.map((id) => map.get(id)).filter(Boolean) as string[];
  }, [categories, entry]);

  if (!isReady) {
    return <p className="text-sm text-slate-600">Завантаження статті...</p>;
  }

  if (!entry) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        <p>Статтю не знайдено у статичних даних або в адмінці.</p>
        <Link href="/blog" className="mt-3 inline-block font-semibold text-brand hover:underline">
          Повернутися до блогу
        </Link>
      </div>
    );
  }



  return (
    <>
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-64 w-full bg-slate-100 sm:h-80">
          <img src={entry.coverImage || '/logo.png'} alt={entry.title} className="h-full w-full object-cover" />
        </div>

        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{new Date(entry.updatedAt).toLocaleDateString('uk-UA')}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">{entry.title}</h1>
          <p className="mt-4 text-base text-slate-700">{entry.excerpt}</p>

          {categoryNames.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {categoryNames.map((name) => (
                <span key={name} className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                  {name}
                </span>
              ))}
            </div>
          ) : null}

          <ArticleBody body={entry.body} />
        </div>
      </article>

      <BlogEngagement slug={entry.slug} />
    </>
  );
}
