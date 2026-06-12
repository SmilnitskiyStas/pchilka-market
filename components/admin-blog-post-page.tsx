'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import BlogEngagement from '@/components/blog-engagement';
import { categorySupportsContentType, type BlogCategory } from '@/lib/blog-categories';
import type { ContentEntry } from '@/lib/content-entries';
import { fetchBlogContentPayload } from '@/lib/blog-content-client';

type AdminBlogPostPageProps = {
  slug: string;
};

type MarkdownBlock =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string }
  | { type: 'img'; alt: string; src: string; widthPx?: number; heightPx?: number };

type ParsedImageMeta = {
  alt: string;
  widthPx?: number;
  heightPx?: number;
};

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|_([^_]+)_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      const label = match[2];
      const href = match[3];
      const isExternal = href.startsWith('http://') || href.startsWith('https://');
      nodes.push(
        <a
          key={`link-${match.index}`}
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer noopener' : undefined}
          className="font-semibold text-brand underline"
        >
          {label}
        </a>
      );
    } else if (match[4]) {
      nodes.push(
        <strong key={`strong-${match.index}`} className="font-semibold text-slate-900">
          {match[4]}
        </strong>
      );
    } else if (match[5]) {
      nodes.push(
        <em key={`em-${match.index}`} className="italic">
          {match[5]}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function looksLikeImageUrl(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith('data:image/')) return true;

  const isHttp = normalized.startsWith('http://') || normalized.startsWith('https://');
  const isLocal = normalized.startsWith('/img/');
  if (!isHttp && !isLocal) return false;

  return /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?.*)?$/i.test(normalized);
}

function parseImageMeta(rawAlt: string): ParsedImageMeta {
  const parts = rawAlt.split('|').map((part) => part.trim()).filter(Boolean);

  let alt = '';
  let widthPx: number | undefined;
  let heightPx: number | undefined;

  parts.forEach((part, index) => {
    const w = part.match(/^w=(\d{1,4})$/i);
    const h = part.match(/^h=(\d{1,4})$/i);

    if (w) {
      const value = Number.parseInt(w[1], 10);
      if (Number.isFinite(value) && value > 0) widthPx = Math.min(value, 2400);
      return;
    }

    if (h) {
      const value = Number.parseInt(h[1], 10);
      if (Number.isFinite(value) && value > 0) heightPx = Math.min(value, 2400);
      return;
    }

    if (!alt && index === 0) {
      alt = part;
    }
  });

  return {
    alt: alt || 'image',
    widthPx,
    heightPx
  };
}

function parseMarkdownBlocks(raw: string): MarkdownBlock[] {
  const lines = raw.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const markdownLinkRegex = /^\[([^\]]*)\]\(([^)]+)\)$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
      i += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
      i += 1;
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2).trim());
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, '').trim());
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    imageRegex.lastIndex = 0;
    if (imageRegex.test(line)) {
      imageRegex.lastIndex = 0;
      let lastIndex = 0;
      let match: RegExpExecArray | null = null;

      while ((match = imageRegex.exec(line)) !== null) {
        const before = line.slice(lastIndex, match.index).trim();
        if (before) {
          blocks.push({ type: 'p', text: before });
        }

        const meta = parseImageMeta((match[1] || '').trim());
        const src = (match[2] || '').trim();
        if (src) {
          blocks.push({
            type: 'img',
            alt: meta.alt,
            src,
            widthPx: meta.widthPx,
            heightPx: meta.heightPx
          });
        }

        lastIndex = match.index + match[0].length;
      }

      const after = line.slice(lastIndex).trim();
      if (after) {
        blocks.push({ type: 'p', text: after });
      }

      i += 1;
      continue;
    }

    const markdownLinkMatch = line.match(markdownLinkRegex);
    if (markdownLinkMatch && looksLikeImageUrl(markdownLinkMatch[2])) {
      const meta = parseImageMeta(markdownLinkMatch[1] || '');
      blocks.push({
        type: 'img',
        alt: meta.alt,
        src: markdownLinkMatch[2].trim(),
        widthPx: meta.widthPx,
        heightPx: meta.heightPx
      });
      i += 1;
      continue;
    }

    if (looksLikeImageUrl(line)) {
      blocks.push({ type: 'img', alt: 'image', src: line });
      i += 1;
      continue;
    }

    blocks.push({ type: 'p', text: line });
    i += 1;
  }

  return blocks;
}

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
    () => entries.find((item) => item.contentType === 'blog' && item.status === 'published' && item.slug === slug),
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

  const blocks = parseMarkdownBlocks(entry.body);

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

          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-800">
            {blocks.map((block, index) => {
              if (block.type === 'h2') return <h2 key={`h2-${index}`} className="text-2xl font-bold text-slate-900">{renderInlineMarkdown(block.text)}</h2>;
              if (block.type === 'h3') return <h3 key={`h3-${index}`} className="text-xl font-semibold text-slate-900">{renderInlineMarkdown(block.text)}</h3>;
              if (block.type === 'ul') return <ul key={`ul-${index}`} className="list-inside list-disc space-y-1">{block.items.map((item, i) => <li key={`uli-${i}`}>{renderInlineMarkdown(item)}</li>)}</ul>;
              if (block.type === 'ol') return <ol key={`ol-${index}`} className="list-inside list-decimal space-y-1">{block.items.map((item, i) => <li key={`oli-${i}`}>{renderInlineMarkdown(item)}</li>)}</ol>;
              if (block.type === 'img') {
                const style: CSSProperties = {
                  maxWidth: '100%',
                  width: block.widthPx ? `${block.widthPx}px` : '100%',
                  height: block.heightPx ? `${block.heightPx}px` : 'auto'
                };

                return (
                  <img
                    key={`img-${index}`}
                    src={block.src}
                    alt={block.alt}
                    style={style}
                    className="rounded-xl bg-slate-50 object-contain"
                  />
                );
              }
              return <p key={`p-${index}`}>{renderInlineMarkdown(block.text)}</p>;
            })}
          </div>
        </div>
      </article>

      <BlogEngagement slug={entry.slug} />
    </>
  );
}
