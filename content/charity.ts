export type CharityPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  thumbnailImage: string;
  coverImage: string;
  content: string[];
};

// Publications are managed through admin/content; no demo fallback.
export const charityPosts: CharityPost[] = [];

export function getCharityPostBySlug(slug: string) {
  return charityPosts.find((post) => post.slug === slug);
}
