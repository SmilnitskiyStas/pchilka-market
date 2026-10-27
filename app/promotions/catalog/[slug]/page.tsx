import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import PromotionCatalogViewer from '@/components/promotion-catalog-viewer';
import { getPromotionCatalogPages } from '@/lib/promotion-catalog-pages';
import { getPromotionCatalogs } from '@/lib/promotion-catalogs';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
const getPage = cache(async (slug: string) => {
  const page = (await getPromotionCatalogPages()).find((item) => item.slug === slug);
  if (!page) notFound();
  return { page, catalogs: await getPromotionCatalogs(page.id) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page, catalogs } = await getPage((await params).slug);
  const current = catalogs[0];
  return {
    title: current?.seoTitle || `${page.title} | Pchilka Market`,
    description: current?.seoDescription || page.description || `Актуальні пропозиції: ${page.title}.`,
    keywords: current?.seoKeywords || undefined,
    robots: page.showInList ? undefined : { index: false, follow: false }
  };
}

export default async function CatalogPage({ params }: Props) {
  const { page, catalogs } = await getPage((await params).slug);
  return (
    <main className="site-container min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/promotions/catalog" className="text-sm font-semibold text-brand hover:underline">← Усі каталоги</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">{page.title}</h1>
      {page.description ? <p className="mt-3 text-slate-600">{page.description}</p> : null}
      <div className="mt-6"><PromotionCatalogViewer catalogs={catalogs} showArchive={page.showArchive} /></div>
    </main>
  );
}
