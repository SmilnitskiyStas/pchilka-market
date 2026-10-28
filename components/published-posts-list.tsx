import Link from 'next/link';
import { getBlogContentFromDb } from '@/lib/blog-content-repository';
import { categorySupportsContentType } from '@/lib/blog-categories';
import type { ContentType } from '@/lib/content-types';

export default async function PublishedPostsList({ contentType, hrefPrefix }: { contentType: ContentType; hrefPrefix: string }) {
  let payload;
  try {
    payload = await getBlogContentFromDb();
  } catch {
    return <p role="status" className="text-sm text-slate-600">Не вдалося завантажити публікації. Спробуйте пізніше.</p>;
  }
  const entries = payload.entries
    .filter((entry) => !entry.pagePath && entry.contentType === contentType && entry.status === 'published')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!entries.length) return <p className="text-sm text-slate-600">Публікацій поки немає.</p>;
  const categories = payload.categories.filter((category) => category.isActive && categorySupportsContentType(category, contentType));
  return <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
    {entries.map((entry) => <article key={entry.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {entry.coverImage ? <img src={entry.coverImage} alt={entry.title} loading="lazy" decoding="async" className="h-44 w-full object-cover" /> : null}
      <div className="p-4 sm:p-5">
        <p className="text-xs text-slate-500">{new Date(entry.updatedAt).toLocaleDateString('uk-UA')}</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">{entry.title}</h2>
        <p className="mt-2 text-sm text-slate-700">{entry.excerpt}</p>
        <div className="mt-2 flex flex-wrap gap-2">{categories.filter((category) => entry.categoryIds.includes(category.id)).map((category) => <span key={category.id} className="rounded-full bg-brand/10 px-2 py-1 text-xs text-brand">{category.name}</span>)}</div>
        <Link href={`${hrefPrefix}/${entry.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">{contentType === 'news' ? 'Читати новину' : 'Читати статтю'}</Link>
      </div>
    </article>)}
  </div>;
}
