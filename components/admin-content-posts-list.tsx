'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { ContentEntry } from '@/lib/content-entries';
import type { ContentType } from '@/lib/content-types';
import { fetchBlogContentPayload } from '@/lib/blog-content-client';

type AdminContentPostsListProps = {
  contentType: ContentType;
  staticSlugs: string[];
  listHrefPrefix: string;
  sectionLabel: string;
  sectionTitle: string;
};

export default function AdminContentPostsList({
  contentType,
  staticSlugs,
  listHrefPrefix,
  sectionLabel,
  sectionTitle
}: AdminContentPostsListProps) {
  const [entries, setEntries] = useState<ContentEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const payload = await fetchBlogContentPayload();
        if (cancelled) return;
        setEntries(payload.entries);
      } catch {
        if (cancelled) return;
        setEntries([]);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const staticSlugSet = useMemo(() => new Set(staticSlugs), [staticSlugs]);

  const publishedEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.contentType === contentType && entry.status === 'published' && !staticSlugSet.has(entry.slug))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [contentType, entries, staticSlugSet]
  );

  if (publishedEntries.length === 0) return null;

  return (
    <section className="mt-6 rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:mt-8 sm:p-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{sectionLabel}</p>
        <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{sectionTitle}</h2>
      </div>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {publishedEntries.map((entry) => {
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
                <Link href={`${listHrefPrefix}/${entry.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
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

