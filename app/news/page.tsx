import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import AdminContentPostsList from '@/components/admin-content-posts-list';
import { newsPosts } from '@/content/news';

export const metadata: Metadata = {
  title: 'Новини мережі | Pchilka Market',
  description: 'Офіційні новини мережі Pchilka Market: події, оновлення та важлива інформація для покупців.'
};

export default function NetworkNewsPage() {
  const staticSlugs = newsPosts.map((post) => post.slug);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Про мережу</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Новини мережі</h1>
          <p className="mt-2 text-sm text-slate-600">Актуальні оновлення та новини Pchilka Market.</p>
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {newsPosts.map((post) => (
            <article
              key={post.slug}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:shadow-lg"
            >
              <div className="relative h-40 w-full sm:h-44">
                <Image src={post.thumbnailImage} alt={post.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
              </div>

              <div className="p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{post.publishedAt}</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{post.title}</h2>
                <p className="mt-2 text-sm text-slate-700">{post.excerpt}</p>
                <Link href={`/news/${post.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
                  Читати новину
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <AdminContentPostsList
        contentType="news"
        staticSlugs={staticSlugs}
        listHrefPrefix="/news"
        sectionLabel="З адмінки"
        sectionTitle="Новини мережі (опубліковані)"
      />
    </main>
  );
}


