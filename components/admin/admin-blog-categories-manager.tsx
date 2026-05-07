'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { blogPosts } from '@/content/blog';
import { charityPosts } from '@/content/charity';
import { newsPosts } from '@/content/news';
import { contentTypeLabels, type ContentType } from '@/lib/content-types';
import { normalizeContentEntry, type ContentEntry } from '@/lib/content-entries';
import {
  categorySupportsContentType,
  getCategoryContentTypes,
  normalizeCategory,
  normalizeCategorySlug,
  type BlogCategory
} from '@/lib/blog-categories';
import { fetchBlogContentPayload, saveBlogContentPayload } from '@/lib/blog-content-client';

type PostOption = {
  slug: string;
  title: string;
  contentType: ContentType;
};

const staticPosts: PostOption[] = [
  ...blogPosts.map((post) => ({ slug: post.slug, title: post.title, contentType: 'blog' as const })),
  ...newsPosts.map((post) => ({ slug: post.slug, title: post.title, contentType: 'news' as const })),
  ...charityPosts.map((post) => ({ slug: post.slug, title: post.title, contentType: 'charity' as const }))
];

export default function AdminBlogCategoriesManager() {
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [entries, setEntries] = useState<PostOption[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const [selectedContentTypes, setSelectedContentTypes] = useState<ContentType[]>(['blog']);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('100');
  const [isActive, setIsActive] = useState(true);
  const [postSlugs, setPostSlugs] = useState<string[]>([]);

  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const autoSlug = normalizeCategorySlug(name);
  const isEditing = editingId !== null;

  const allPosts = useMemo(() => {
    const map = new Map<string, PostOption>();
    [...staticPosts, ...entries].forEach((item) => {
      const key = `${item.contentType}:${item.slug}`;
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()];
  }, [entries]);

  const filteredPostOptions = useMemo(
    () => allPosts.filter((post) => selectedContentTypes.includes(post.contentType)),
    [allPosts, selectedContentTypes]
  );

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const remote = await fetchBlogContentPayload();
        if (cancelled) return;

        setCategories(remote.categories);
        setEntries(
          remote.entries.map((entry) => ({
            slug: entry.slug,
            title: entry.title,
            contentType: entry.contentType
          }))
        );
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : 'Не вдалося завантажити категорії.';
        setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setEditingId(null);
    setSelectedContentTypes(['blog']);
    setName('');
    setDescription('');
    setSortOrder('100');
    setIsActive(true);
    setPostSlugs([]);
    setError('');
  }

  async function persist(next: BlogCategory[]) {
    setIsSyncing(true);
    try {
      const remote = await fetchBlogContentPayload();
      const nextEntries = remote.entries.map((entry) => {
        const categoryIds = next
          .filter((category) => categorySupportsContentType(category, entry.contentType) && category.postSlugs.includes(entry.slug))
          .map((category) => category.id);

        return normalizeContentEntry({
          ...(entry as ContentEntry),
          categoryIds
        });
      });

      const saved = await saveBlogContentPayload({
        entries: nextEntries,
        categories: next
      });
      setCategories(saved.categories);
      setEntries(
        saved.entries.map((entry) => ({
          slug: entry.slug,
          title: entry.title,
          contentType: entry.contentType
        }))
      );
      setIsSaved(true);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Не вдалося зберегти категорії.';
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  function togglePost(slugValue: string) {
    setPostSlugs((prev) =>
      prev.includes(slugValue) ? prev.filter((value) => value !== slugValue) : [...prev, slugValue]
    );
    setIsSaved(false);
  }

  function toggleContentType(type: ContentType) {
    setSelectedContentTypes((prev) => {
      const next = prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type];
      const normalized: ContentType[] = next.length > 0 ? next : ['blog'];
      setPostSlugs((existing) =>
        existing.filter((slug) =>
          allPosts.some((post) => post.slug === slug && normalized.includes(post.contentType))
        )
      );
      return normalized;
    });
    setIsSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = name.trim();
    const normalizedSlug = normalizeCategorySlug(name);
    const normalizedDescription = description.trim();
    const normalizedOrder = Number.parseInt(sortOrder, 10);

    if (!normalizedName) {
      setError('Вкажіть назву категорії.');
      return;
    }

    if (!normalizedSlug) {
      setError('Slug не може бути порожнім.');
      return;
    }

    if (!Number.isFinite(normalizedOrder)) {
      setError('Порядок сортування має бути числом.');
      return;
    }

    if (selectedContentTypes.length === 0) {
      setError('Оберіть хоча б один блок контенту для категорії.');
      return;
    }

    const duplicate = categories.find((category) => {
      if (category.id === editingId) return false;
      if (category.slug !== normalizedSlug) return false;
      const categoryTypes = getCategoryContentTypes(category);
      return selectedContentTypes.some((type) => categoryTypes.includes(type));
    });

    if (duplicate) {
      setError('Категорія з таким slug вже існує у вибраному блоці контенту.');
      return;
    }

    const draft = normalizeCategory({
      id: editingId ?? `blog_cat_${Date.now()}`,
      contentType: selectedContentTypes[0],
      contentTypes: selectedContentTypes,
      name: normalizedName,
      slug: normalizedSlug,
      description: normalizedDescription,
      isActive,
      sortOrder: normalizedOrder,
      postSlugs,
      updatedAt: new Date().toISOString()
    });

    const next = isEditing
      ? categories.map((category) => (category.id === editingId ? draft : category))
      : [draft, ...categories];

    await persist(next);
    resetForm();
  }

  function handleEdit(category: BlogCategory) {
    setEditingId(category.id);
    setSelectedContentTypes(getCategoryContentTypes(category));
    setName(category.name);
    setDescription(category.description);
    setSortOrder(String(category.sortOrder));
    setIsActive(category.isActive);
    setPostSlugs(category.postSlugs);
    setExpandedCategoryId(category.id);
    setError('');
    setIsSaved(false);
  }

  async function handleDelete(categoryId: string) {
    const next = categories.filter((category) => category.id !== categoryId);
    await persist(next);
    if (editingId === categoryId) resetForm();
  }

  function getPostTitle(slugValue: string) {
    return allPosts.find((post) => post.slug === slugValue)?.title ?? slugValue;
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Контент / Категорії</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Категорії контенту</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        Керуйте категоріями для блоків `Блог`, `Новини мережі`, `Благодійність`. `Slug` формується автоматично.
      </p>
      {isLoading ? <p className="mt-2 text-sm font-semibold text-slate-600">Завантаження категорій з БД...</p> : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div>
          <p className="block text-sm font-semibold text-slate-900">Блоки контенту</p>
          <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {(['blog', 'news', 'charity'] as ContentType[]).map((type) => {
              const checked = selectedContentTypes.includes(type);
              return (
                <label key={type} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleContentType(type)}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  {contentTypeLabels[type]}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="blog-category-name" className="block text-sm font-semibold text-slate-900">Назва категорії</label>
          <input
            id="blog-category-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setIsSaved(false);
            }}
            placeholder="Наприклад: Поради покупцям"
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <div>
          <p className="block text-sm font-semibold text-slate-900">Slug категорії (авто)</p>
          <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{autoSlug || '—'}</div>
        </div>

        <div>
          <label htmlFor="blog-category-description" className="block text-sm font-semibold text-slate-900">Опис категорії</label>
          <textarea
            id="blog-category-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setIsSaved(false);
            }}
            rows={3}
            placeholder="Короткий опис категорії"
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <div>
          <label htmlFor="blog-category-order" className="block text-sm font-semibold text-slate-900">Порядок сортування</label>
          <input
            id="blog-category-order"
            type="number"
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value);
              setIsSaved(false);
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => {
              setIsActive(event.target.checked);
              setIsSaved(false);
            }}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          Активна категорія
        </label>

        <div>
          <p className="block text-sm font-semibold text-slate-900">Прив'язка статей</p>
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            {filteredPostOptions.map((post) => {
              const checked = postSlugs.includes(post.slug);
              return (
                <label key={`${post.contentType}:${post.slug}`} className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePost(post.slug)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <span>
                    <span className="font-semibold text-slate-900">{post.title}</span>
                    <span className="block text-xs text-slate-500">{contentTypeLabels[post.contentType]} /{post.slug}</span>
                  </span>
                </label>
              );
            })}
            {filteredPostOptions.length === 0 ? <p className="text-xs text-slate-500">У вибраних блоках поки немає статей.</p> : null}
          </div>
        </div>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {isSaved ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Категорію збережено.</p> : null}

        <div className="flex items-center justify-end gap-2">
          {isEditing ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
            >
              Скасувати редагування
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSyncing}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEditing ? 'Зберегти зміни' : 'Додати категорію'}
          </button>
        </div>
      </form>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Список категорій</h2>
          <p className="text-xs font-semibold text-slate-600">Усього: {sortedCategories.length}</p>
        </div>

        {sortedCategories.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Категорій ще немає.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {sortedCategories.map((category) => (
              <li key={category.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{category.name}</p>
                    <p className="text-xs text-slate-600">
                      {getCategoryContentTypes(category).map((type) => contentTypeLabels[type]).join(', ')} • {category.isActive ? 'Активна' : 'Неактивна'} • Статей: {category.postSlugs.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedCategoryId((prev) => (prev === category.id ? null : category.id))}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                  >
                    {expandedCategoryId === category.id ? 'Згорнути' : 'Розгорнути'}
                  </button>
                </div>

                {expandedCategoryId === category.id ? (
                  <div className="mt-3 space-y-1 border-t border-slate-200 pt-3">
                    <p><span className="font-semibold text-slate-900">Slug:</span> {category.slug}</p>
                    <p><span className="font-semibold text-slate-900">Опис:</span> {category.description || '—'}</p>
                    <p><span className="font-semibold text-slate-900">Порядок:</span> {category.sortOrder}</p>
                    <p>
                      <span className="font-semibold text-slate-900">Статті:</span>{' '}
                      {category.postSlugs.length > 0 ? category.postSlugs.map(getPostTitle).join(', ') : '—'}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(category)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                      >
                        Редагувати
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDelete(category.id);
                        }}
                        className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                      >
                        Видалити
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
