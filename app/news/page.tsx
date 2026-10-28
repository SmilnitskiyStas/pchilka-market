import PublishedPostsList from '@/components/published-posts-list';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Новини мережі | Pchilka Market',
  description: 'Офіційні новини мережі Pchilka Market: події, оновлення та важлива інформація для покупців.'
};

export default function NetworkNewsPage() {

  return (
    <main className="site-container min-h-screen px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Про мережу</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Новини мережі</h1>
          <p className="mt-2 text-sm text-slate-600">Актуальні оновлення та новини Pchilka Market.</p>
        </div>

        <PublishedPostsList contentType="news" hrefPrefix="/news" />
      </section>
    </main>
  );
}


