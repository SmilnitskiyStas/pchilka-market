import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getPromotionBySlugFromDb } from '@/lib/promotions-repository';

type PromotionPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function formatPeriodValue(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitContent(content: string) {
  return content
    .split(/\r?\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getStatusLabel(status: 'draft' | 'published' | 'archived') {
  switch (status) {
    case 'published':
      return 'Опубліковано';
    case 'archived':
      return 'Архів';
    default:
      return 'Чернетка';
  }
}

function getStatusClasses(status: 'draft' | 'published' | 'archived') {
  switch (status) {
    case 'published':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'archived':
      return 'border-slate-300 bg-slate-100 text-slate-700';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}

export async function generateMetadata({ params }: PromotionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const promotion = await getPromotionBySlugFromDb(slug);

  if (!promotion) {
    return {
      title: 'Акцію не знайдено | Pchilka Market'
    };
  }

  const description = stripHtml(promotion.shortDescription || promotion.content).slice(0, 160);
  const canonicalPath = `/promotions/${promotion.slug}`;
  const isIndexable = promotion.status === 'published';

  return {
    title: `${promotion.title} | Акції | Pchilka Market`,
    description: description || 'Актуальна акція мережі Pchilka Market.',
    alternates: {
      canonical: canonicalPath
    },
    robots: {
      index: isIndexable,
      follow: isIndexable
    }
  };
}

export default async function PromotionPage({ params }: PromotionPageProps) {
  const { slug } = await params;
  const promotion = await getPromotionBySlugFromDb(slug);

  if (!promotion) {
    notFound();
  }

  const paragraphs = splitContent(promotion.content);
  const periodFrom = formatPeriodValue(promotion.startsAt);
  const periodTo = formatPeriodValue(promotion.endsAt);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {promotion.imageUrl ? (
          <div className="relative h-64 w-full bg-slate-100 sm:h-80 lg:h-[26rem]">
            <Image
              src={promotion.imageUrl}
              alt={promotion.title}
              fill
              sizes="(max-width: 768px) 100vw, 1200px"
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(promotion.status)}`}>
              {getStatusLabel(promotion.status)}
            </span>
            {promotion.isWeekly ? (
              <span className="inline-flex rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                Акція тижня
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">{promotion.title}</h1>

          {promotion.shortDescription ? (
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-700 sm:text-lg">{promotion.shortDescription}</p>
          ) : null}

          {periodFrom || periodTo ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Період дії:</span>{' '}
              {periodFrom || '—'} - {periodTo || '—'}
            </div>
          ) : null}

          {paragraphs.length > 0 ? (
            <div className="mt-8 space-y-4 text-base leading-relaxed text-slate-800">
              {paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <p className="mt-8 text-base text-slate-600">Опис для цієї акції ще не додано.</p>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/promotions"
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
            >
              Назад до розділу акцій
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
