export type NewsPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  thumbnailImage: string;
  coverImage: string;
  content: string[];
};

// Publications are managed through admin/content; no demo fallback.
export const newsPosts: NewsPost[] = [];

export function getNewsPostBySlug(slug: string) {
  return newsPosts.find((post) => post.slug === slug);
}
