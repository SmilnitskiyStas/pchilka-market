export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  thumbnailImage: string;
  coverImage: string;
  content: string[];
};

// Publications are managed through admin/content; no demo fallback.
export const blogPosts: BlogPost[] = [];

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
