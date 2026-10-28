import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPromotionCatalogSettings } from '@/lib/promotion-catalog-metadata';
import { getPromotionCatalogPages } from '@/lib/promotion-catalog-pages';
import { catalogPageHref } from '@/lib/promotion-catalog-page-types';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const { landingTitle } = await getPromotionCatalogSettings();
  return { title: `${landingTitle} | Pchilka Market`, description: 'Оберіть актуальний каталог акцій Пчілка маркет.' };
}

export default async function PromotionsCatalogPage() {
  const pages = (await getPromotionCatalogPages()).filter((page) => page.showInList);
  if (pages.length === 1) redirect(catalogPageHref(pages[0]));
  const { landingTitle } = await getPromotionCatalogSettings();
  return (
    <main className="site-container min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-slate-900">{landingTitle}</h1>
      <p className="mt-3 text-slate-600">Оберіть потрібний каталог, щоб переглянути актуальні пропозиції.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {pages.map((page) => <Link key={page.id} href={catalogPageHref(page)} className="rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-brand hover:shadow-md"><h2 className="text-2xl font-bold text-brand">{page.title}</h2><p className="mt-3 text-sm text-slate-600">{page.description}</p><span className="mt-5 inline-block font-semibold text-brand">Переглянути каталог →</span></Link>)}
      </div>
      {pages.length === 0 ? <p className="mt-6 text-slate-600">Сторінок каталогів поки немає.</p> : null}
    </main>
  );
}
