import { NextResponse } from 'next/server';
import { getBlogContentFromDb } from '@/lib/blog-content-repository';
import { entryPagePath } from '@/lib/menu-content';
import { blogPosts } from '@/content/blog';
import { newsPosts } from '@/content/news';
import { charityPosts } from '@/content/charity';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { entries } = await getBlogContentFromDb();
    const published = entries.filter((entry) => entry.status === 'published');
    const populatedPaths = new Set(published.map(entryPagePath));
    if (blogPosts.length) populatedPaths.add('/blog');
    if (newsPosts.length) populatedPaths.add('/news');
    if (charityPosts.length) populatedPaths.add('/about/charity');
    return NextResponse.json({ entries: published.filter((entry) => entry.pagePath), populatedPaths: [...populatedPaths] });
  } catch {
    return NextResponse.json({ error: 'Не вдалося завантажити контент.' }, { status: 503 });
  }
}
