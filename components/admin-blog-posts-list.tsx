'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { categorySupportsContentType, type BlogCategory } from '@/lib/blog-categories';
import type { ContentEntry } from '@/lib/content-entries';
import { fetchBlogContentPayload } from '@/lib/blog-content-client';

type AdminBlogPostsListProps = {
  staticSlugs: string[];
};

export default function AdminBlogPostsList({ staticSlugs }: AdminBlogPostsListProps) {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const payload = await fetchBlogContentPayload();
        if (cancelled) return;
        setEntries(payload.entries);
        setCategories(payload.categories);
      } catch {
        if (cancelled) return;
        setEntries([]);
        setCategories([]);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const staticSlugSet = useMemo(() => new Set(staticSlugs), [staticSlugs]);

  const adminBlogEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.contentType === 'blog' && entry.status === 'published' && !staticSlugSet.has(entry.slug))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [entries, staticSlugSet]
  );

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => {
      if (categorySupportsContentType(category, 'blog') && category.isActive) {
        map.set(category.id, category.name);
      }
    });
    return map;
  }, [categories]);

  if (adminBlogEntries.length === 0) return null;

  return (
    <section className="mt-6 rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:mt-8 sm:p-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">З адмінки</p>
        <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">Нові статті (опубліковані)</h2>
      </div>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {adminBlogEntries.map((entry) => {
          const categoryNames = entry.categoryIds.map((id) => categoryMap.get(id)).filter(Boolean) as string[];
          const cover = entry.coverImage || '/img/logo.png';

          return (
            <article
              key={entry.id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:shadow-lg"
            >
              <div className="h-40 w-full bg-slate-100 sm:h-44">
                <img src={cover} alt={entry.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </div>

              <div className="p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {new Date(entry.updatedAt).toLocaleDateString('uk-UA')}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{entry.title}</h3>
                <p className="mt-2 text-sm text-slate-700">{entry.excerpt}</p>

                {categoryNames.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categoryNames.map((name) => (
                      <span key={`${entry.id}-${name}`} className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                        {name}
                      </span>
                    ))}
                  </div>
                ) : null}

                <Link href={`/blog/${entry.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
                  Читати статтю
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
