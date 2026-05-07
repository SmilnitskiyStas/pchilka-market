'use client';

import { useEffect, useMemo, useState } from 'react';

import { categorySupportsContentType, loadBlogCategoriesFromStorage, type BlogCategory } from '@/lib/blog-categories';

type BlogPostCategoriesProps = {
  postSlug: string;
  compact?: boolean;
};

export default function BlogPostCategories({ postSlug, compact = false }: BlogPostCategoriesProps) {
  const [categories, setCategories] = useState<BlogCategory[]>([]);

  useEffect(() => {
    setCategories(loadBlogCategoriesFromStorage());
  }, []);

  const postCategories = useMemo(
    () =>
      categories
        .filter((category) => categorySupportsContentType(category, 'blog') && category.isActive && category.postSlugs.includes(postSlug))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories, postSlug]
  );

  if (postCategories.length === 0) return null;

  return (
    <div className={compact ? 'mt-2 flex flex-wrap gap-2' : 'mt-4'}>
      {compact ? null : <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Категорії</p>}
      <div className={compact ? 'flex flex-wrap gap-2' : 'mt-2 flex flex-wrap gap-2'}>
        {postCategories.map((category) => (
          <span
            key={category.id}
            className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand"
          >
            {category.name}
          </span>
        ))}
      </div>
    </div>
  );
}
