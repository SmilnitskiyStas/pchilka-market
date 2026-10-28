import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import VisualPageBody from '@/components/visual-page-body';
import { getAdminSessionCookieName, getCurrentAdminAccessFromToken } from '@/lib/admin-auth';
import { hasAdminPermission } from '@/lib/admin-permissions';
import { getVisualPage } from '@/lib/visual-pages-repository';
import { visualPageHref } from '@/lib/visual-pages';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  // Draft titles and descriptions never enter public metadata, even with ?preview=1.
  const page = (await getVisualPage(slug))?.published;
  const title = page?.seo?.title || (page ? `${page.title} | Pchilka Market` : 'Сторінка | Pchilka Market');
  const canonical = page ? visualPageHref(page.slug) : undefined;
  return { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://pchilka-market.ua'), title, description: page?.description, alternates: { canonical },
    openGraph: { title, description: page?.description, url: canonical, ...(page?.seo?.image ? { images: [page.seo.image] } : {}) },
    twitter: { card: page?.seo?.image ? 'summary_large_image' : 'summary', title, description: page?.description, ...(page?.seo?.image ? { images: [page.seo.image] } : {}) },
    ...(query.preview || page?.seo?.noIndex ? { robots: { index: false, follow: false } } : {}) };
}
export default async function VisualPageScreen({ params, searchParams }: Props) {
  const [{ slug }, query, jar] = await Promise.all([params, searchParams, cookies()]);
  const session = await getCurrentAdminAccessFromToken(jar.get(getAdminSessionCookieName())?.value);
  const canRead = session && hasAdminPermission(session.role, session.permissions, 'content', 'read');
  const canEdit = session && hasAdminPermission(session.role, session.permissions, 'content', 'write');
  if (query.preview && !canRead) notFound();
  const record = await getVisualPage(slug);
  const page = query.preview ? record?.draft : record?.published;
  if (!page) notFound();
  if (page.slug !== slug || slug === 'rental-intro') permanentRedirect(`${visualPageHref(page.slug)}${query.preview ? '?preview=1' : ''}`);
  return <main className="site-container min-h-screen px-4 py-8 sm:px-6 lg:px-8">
    {canEdit ? <aside className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-white p-4 text-sm">
      <span>{query.preview ? 'Попередній перегляд збереженої чернетки' : 'Ви переглядаєте опубліковану версію'}</span>
      <Link href={`/admin/pages?slug=${slug}`} className="font-semibold text-brand underline">Редагувати сторінку</Link>
    </aside> : null}
    <VisualPageBody page={page} editing={!!query.preview} />
  </main>;
}
