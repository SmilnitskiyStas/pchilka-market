'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import BlogEngagement from '@/components/blog-engagement';
import { fetchBlogContentPayload } from '@/lib/blog-content-client';
import type { ContentEntry } from '@/lib/content-entries';
import type { ContentType } from '@/lib/content-types';

type AdminContentPostPageProps = {
  slug: string;
  contentType: ContentType;
  listHref: string;
  engagementSlugPrefix?: string;
};

function parseTextBlocks(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AdminContentPostPage({ slug, contentType, listHref, engagementSlugPrefix = '' }: AdminContentPostPageProps) {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const payload = await fetchBlogContentPayload();
        if (cancelled) return;
        setEntries(payload.entries);
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
    () => entries.find((item) => item.contentType === contentType && item.status === 'published' && item.slug === slug),
    [contentType, entries, slug]
  );

  if (!isReady) return <p className="text-sm text-slate-600">Завантаження статті...</p>;

  if (!entry) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
        <p>Статтю не знайдено у статичних даних або в адмінці.</p>
        <Link href={listHref} className="mt-3 inline-block font-semibold text-brand hover:underline">
          Повернутися до списку
        </Link>
      </div>
    );
  }

  const paragraphs = parseTextBlocks(entry.body);

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

          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-800">
            {(paragraphs.length > 0 ? paragraphs : [entry.body]).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </article>

      <BlogEngagement slug={`${engagementSlugPrefix}${entry.slug}`} />
    </>
  );
}
