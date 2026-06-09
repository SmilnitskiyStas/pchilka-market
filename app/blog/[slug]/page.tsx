import Image from 'next/image';

import AdminBlogPostPage from '@/components/admin-blog-post-page';
import BlogEngagement from '@/components/blog-engagement';
import BlogPostCategories from '@/components/blog-post-categories';
import { blogPosts, getBlogPostBySlug } from '@/content/blog';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug
  }));
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <AdminBlogPostPage slug={slug} />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative h-64 w-full sm:h-80">
          <Image src={post.coverImage} alt={post.title} fill className="object-cover" />
        </div>

        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{post.publishedAt}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">{post.title}</h1>
          <p className="mt-4 text-base text-slate-700">{post.excerpt}</p>
          <BlogPostCategories postSlug={post.slug} />

          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-800">
            {post.content.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </article>

      <BlogEngagement slug={post.slug} />
    </main>
  );
}
