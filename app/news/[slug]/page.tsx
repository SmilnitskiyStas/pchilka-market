import type { Metadata } from 'next';
import Image from 'next/image';
import AdminContentPostPage from '@/components/admin-content-post-page';
import { getNewsPostBySlug, newsPosts } from '@/content/news';
import BlogEngagement from '@/components/blog-engagement';

type NewsPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return newsPosts.map((post) => ({
    slug: post.slug
  }));
}

export async function generateMetadata({ params }: NewsPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getNewsPostBySlug(slug);

  if (!post) {
    return {
      title: 'Новина не знайдена | Pchilka Market'
    };
  }

  return {
    title: `${post.title} | Новини мережі | Pchilka Market`,
    description: post.excerpt
  };
}

export default async function NewsPostPage({ params }: NewsPostPageProps) {
  const { slug } = await params;
  const post = getNewsPostBySlug(slug);

  if (!post) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <AdminContentPostPage slug={slug} contentType="news" listHref="/news" engagementSlugPrefix="news_" />
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

          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-800">
            {post.content.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </article>

      <BlogEngagement slug={`news_${post.slug}`} />
    </main>
  );
}
