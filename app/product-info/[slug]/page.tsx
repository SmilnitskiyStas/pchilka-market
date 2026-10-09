import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getImportProductBySlug, importProducts } from '@/content/import-products';

type ProductInfoPageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return importProducts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ProductInfoPageProps): Promise<Metadata> {
  const product = getImportProductBySlug((await params).slug);
  if (!product) return { title: 'Сторінку не знайдено | Pchilka Market' };

  return {
    title: `${product.name} | Інформація про товар | Pchilka Market`,
    description: `Інформація про склад, харчову цінність та імпортера товару «${product.name}».`,
    robots: { index: false, follow: false }
  };
}

export default async function ProductInfoPage({ params }: ProductInfoPageProps) {
  const product = getImportProductBySlug((await params).slug);
  if (!product) notFound();

  const nutritionRows = [
    ['Жири', product.nutrition.fat], ['з них насичені жири', product.nutrition.saturatedFat],
    ['Вуглеводи', product.nutrition.carbohydrates], ['з них цукри', product.nutrition.sugars],
    ['Білок', product.nutrition.protein], ['Сіль', product.nutrition.salt]
  ];

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
      <article className="overflow-hidden rounded-3xl border border-brand/25 bg-white shadow-sm">
        <header className="bg-gradient-to-br from-brand to-[#4c8617] px-5 py-7 text-white sm:px-9 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Інформація про товар</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">{product.name}</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/90 sm:text-base">Офіційна інформація для споживача. Сторінку відкрито за QR-кодом на товарі.</p>
        </header>
        <div className="space-y-8 p-5 sm:p-9">
          <section><h2 className="text-xl font-bold text-slate-900">Склад</h2><p className="mt-3 text-base leading-7 text-slate-700">{product.ingredients}</p><p className="mt-2 font-medium text-slate-800">{product.fruitContent}</p></section>
          <section className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="bg-slate-50 px-4 py-4 sm:px-5"><h2 className="text-xl font-bold text-slate-900">Поживна цінність</h2><p className="mt-1 text-sm text-slate-600">на 100 мл продукту</p></div>
            <dl className="divide-y divide-slate-100">
              {nutritionRows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-5 px-4 py-3.5 text-sm sm:px-5 sm:text-base"><dt className="text-slate-700">{label}</dt><dd className="shrink-0 font-semibold text-slate-900">{value}</dd></div>)}
              <div className="flex items-center justify-between gap-5 bg-brand/5 px-4 py-4 text-sm sm:px-5 sm:text-base"><dt className="font-semibold text-slate-800">Енергетична цінність</dt><dd className="shrink-0 font-bold text-brand">{product.nutrition.energy}</dd></div>
            </dl>
          </section>
          <section className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-[#f6faef] p-5"><h2 className="font-bold text-slate-900">Зберігання</h2><p className="mt-2 text-sm leading-6 text-slate-700">{product.storage}</p></div><div className="rounded-2xl bg-[#f6faef] p-5"><h2 className="font-bold text-slate-900">Термін реалізації</h2><p className="mt-2 text-sm leading-6 text-slate-700">{product.shelfLife}</p></div></section>
          <section className="space-y-4 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-bold text-slate-900">Виробник та імпортер</h2><div><h3 className="text-sm font-semibold text-slate-900">Країна походження</h3><p className="mt-1 text-sm leading-6 text-slate-700">{product.countryOfOrigin}</p></div><div><h3 className="text-sm font-semibold text-slate-900">Виробник</h3><p className="mt-1 text-sm leading-6 text-slate-700">{product.manufacturer}</p></div><div><h3 className="text-sm font-semibold text-slate-900">Імпортер в Україні</h3><p className="mt-1 text-sm leading-6 text-slate-700">{product.importer}</p><p className="mt-2 text-sm font-medium text-slate-800">{product.consumerClaims}</p></div></section>
          <section className="rounded-2xl border border-brand/25 bg-brand/5 p-5"><p className="font-semibold text-slate-900">{product.gmo}</p><p className="mt-2 text-sm leading-6 text-slate-700">{product.allergens}</p>{product.barcode ? <p className="mt-3 text-sm text-slate-600">Штрихкод: {product.barcode}</p> : null}</section>
        </div>
      </article>
    </main>
  );
}
