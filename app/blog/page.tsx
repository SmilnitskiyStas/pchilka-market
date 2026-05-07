import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import AdminBlogPostsList from '@/components/admin-blog-posts-list';
import BlogPostCategories from '@/components/blog-post-categories';
import { blogPosts } from '@/content/blog';

export const metadata: Metadata = {
  title: 'Блог | Pchilka Market',
  description: 'Корисні статті, поради та огляди від Pchilka Market.'
};

export default function BlogPage() {
  const staticSlugs = blogPosts.map((post) => post.slug);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Блог</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Нові статті</h1>
          <p className="mt-2 text-sm text-slate-600">Корисні матеріали, новини та поради для покупок.</p>
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((post) => (
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
                <BlogPostCategories postSlug={post.slug} compact />
                <Link href={`/blog/${post.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
                  Читати статтю
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <AdminBlogPostsList staticSlugs={staticSlugs} />
    </main>
  );
}
