'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import AdminBlogCategoriesManager from '@/components/admin/admin-blog-categories-manager';
import { categorySupportsContentType, type BlogCategory } from '@/lib/blog-categories';
import { contentTypeLabels, type ContentType } from '@/lib/content-types';
import {
  normalizeContentEntry,
  normalizeSlug,
  type ContentEntry
} from '@/lib/content-entries';
import { fetchBlogContentPayload, saveBlogContentPayload } from '@/lib/blog-content-client';

type ContentTab = 'articles' | 'categories';

type EditorAction = {
  id: string;
  label: string;
  apply: (selectedText: string) => { insert: string; cursorShift?: number };
};

const editorActions: EditorAction[] = [
  {
    id: 'h2',
    label: 'H2',
    apply: (selectedText) => ({ insert: `## ${selectedText || 'Підзаголовок'}` })
  },
  {
    id: 'h3',
    label: 'H3',
    apply: (selectedText) => ({ insert: `### ${selectedText || 'Блок тексту'}` })
  },
  {
    id: 'bold',
    label: 'Жирний',
    apply: (selectedText) => (selectedText ? { insert: `**${selectedText}**` } : { insert: '****', cursorShift: -2 })
  },
  {
    id: 'italic',
    label: 'Курсив',
    apply: (selectedText) => (selectedText ? { insert: `_${selectedText}_` } : { insert: '__', cursorShift: -1 })
  },
  {
    id: 'ul',
    label: 'Список',
    apply: (selectedText) => ({ insert: selectedText ? `- ${selectedText.replace(/\n/g, '\n- ')}` : '- Пункт 1\n- Пункт 2' })
  },
  {
    id: 'ol',
    label: 'Нумер.',
    apply: (selectedText) => ({ insert: selectedText ? `1. ${selectedText.replace(/\n/g, '\n1. ')}` : '1. Пункт 1\n2. Пункт 2' })
  },
  {
    id: 'link',
    label: 'Посилання',
    apply: (selectedText) => (selectedText ? { insert: `[${selectedText}]()` , cursorShift: -1 } : { insert: '[]()', cursorShift: -3 })
  },
  {
    id: 'image',
    label: 'Зображ.',
    apply: () => ({ insert: '![alt|w=640]()', cursorShift: -1 })
  }
];

function isValidCoverImage(value: string) {
  return value.startsWith('/img/') || value.startsWith('/media/') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/');
}

function getImagePreviewSrc(value: string): string {
  const normalized = value.trim();
  if (!normalized) return normalized;
  if (normalized.startsWith('data:image/')) return normalized;
  return encodeURI(normalized);
}

function formatCoverDisplay(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '—';

  if (normalized.startsWith('data:image/')) {
    const mimeMatch = normalized.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mime = mimeMatch?.[1] ?? 'image/*';
    const base64 = normalized.split(',')[1] ?? '';
    const approxBytes = Math.floor((base64.length * 3) / 4);
    const approxKb = Math.max(1, Math.round(approxBytes / 1024));
    return `${mime} (base64, ~${approxKb} KB)`;
  }

  return normalized;
}

function getCoverLocation(value: string): { label: string; href?: string } {
  const normalized = value.trim();
  if (!normalized) return { label: '—' };

  if (normalized.startsWith('data:image/')) {
    return { label: 'Вбудоване зображення (base64 з адмінки)' };
  }

  if (normalized.startsWith('/')) {
    return { label: normalized, href: normalized };
  }

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const url = new URL(normalized);
      return { label: `${url.host}${url.pathname}`, href: normalized };
    } catch {
      return { label: normalized, href: normalized };
    }
  }

  return { label: normalized };
}

function getContentPreviewHref(contentType: ContentType, slug: string): string {
  const normalizedSlug = normalizeSlug(slug);

  switch (contentType) {
    case 'news':
      return `/news/${normalizedSlug}`;
    case 'charity':
      return `/about/charity/${normalizedSlug}`;
    default:
      return `/blog/${normalizedSlug}`;
  }
}

export default function AdminContentManager() {
  const [activeTab, setActiveTab] = useState<ContentTab>('articles');

  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [contentType, setContentType] = useState<ContentType>('blog');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [serverImages, setServerImages] = useState<string[]>([]);
  const [imageSearch, setImageSearch] = useState('');

  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const autoSlug = normalizeSlug(title);
  const isEditing = editingId !== null;
  const currentPreviewHref = autoSlug || slug ? getContentPreviewHref(contentType, slug || title) : '';

  const availableCategories = useMemo(
    () => categories.filter((category) => categorySupportsContentType(category, contentType) && category.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories, contentType]
  );
  const filteredAvailableCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return availableCategories;
    return availableCategories.filter((category) => category.name.toLowerCase().includes(query) || category.slug.toLowerCase().includes(query));
  }, [availableCategories, categorySearch]);
  const selectedCategoryNames = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category.name]));
    return categoryIds.map((id) => byId.get(id)).filter(Boolean) as string[];
  }, [categories, categoryIds]);

  const visibleServerImages = useMemo(() => {
    const q = imageSearch.trim().toLowerCase();
    if (!q) return serverImages;
    return serverImages.filter((item) => item.toLowerCase().includes(q));
  }, [imageSearch, serverImages]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [entries]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const remote = await fetchBlogContentPayload();
        if (cancelled) return;
        setEntries(remote.entries);
        setCategories(remote.categories);
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : 'Не вдалося завантажити контент блогу.';
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

  useEffect(() => {
    if (activeTab !== 'articles') return;

    let cancelled = false;

    async function refreshArticlesTab() {
      try {
        const remote = await fetchBlogContentPayload();
        if (cancelled) return;
        setEntries(remote.entries);
        setCategories(remote.categories);
      } catch {
        // Keep current in-memory data if refresh fails.
      }
    }

    void refreshArticlesTab();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  function resetForm() {
    setEditingId(null);
    setContentType('blog');
    setTitle('');
    setSlug('');
    setIsSlugManual(false);
    setExcerpt('');
    setBody('');
    setCategoryIds([]);
    setIsCategoryMenuOpen(false);
    setCategorySearch('');
    setCoverImage('');
    setStatus('draft');
    setError('');
  }

  async function persist(nextEntries: ContentEntry[]) {
    setIsSyncing(true);
    try {
      const saved = await saveBlogContentPayload({
        entries: nextEntries,
        categories
      });
      setEntries(saved.entries);
      setCategories(saved.categories);
      setIsSaved(true);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Не вдалося зберегти контент блогу.';
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  function toggleCategory(categoryId: string) {
    setCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
    setIsSaved(false);
  }

  function insertIntoBody(action: EditorAction) {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const selectedText = body.slice(start, end);
    const { insert, cursorShift = 0 } = action.apply(selectedText);

    const next = `${body.slice(0, start)}${insert}${body.slice(end)}`;
    const nextCursor = start + insert.length + cursorShift;

    setBody(next);
    setIsSaved(false);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function openImageModal() {
    setIsImageModalOpen(true);

    if (serverImages.length > 0 || isLoadingImages) return;

    setIsLoadingImages(true);
    try {
      const response = await fetch('/api/admin/images', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch images');

      const data = (await response.json()) as { images?: string[] };
      setServerImages(Array.isArray(data.images) ? data.images : []);
    } catch {
      setError('Не вдалося завантажити список зображень із сервера.');
    } finally {
      setIsLoadingImages(false);
    }
  }

  async function handleCoverUpload(file: File | null) {
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'admin/content/covers');

      const response = await fetch('/api/admin/images', {
        method: 'POST',
        body: formData
      });
      const payload = (await response.json()) as { ok?: boolean; path?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.path) {
        throw new Error(payload.error || 'Не вдалося завантажити файл на сервер.');
      }

      setCoverImage(payload.path);
      setIsSaved(false);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Не вдалося завантажити файл зображення.';
      setError(message);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedTitle = title.trim();
    const normalizedSlug = normalizeSlug(slug || title);
    const normalizedExcerpt = excerpt.trim();
    const normalizedBody = body.trim();
    const normalizedCoverImage = coverImage.trim();

    if (!normalizedTitle) {
      setError('Вкажіть заголовок статті.');
      return;
    }

    if (!normalizedSlug) {
      setError('Не вдалося сформувати slug із заголовка.');
      return;
    }

    if (!normalizedExcerpt) {
      setError('Вкажіть короткий опис статті.');
      return;
    }

    if (!normalizedBody) {
      setError('Додайте основний контент статті.');
      return;
    }

    if (!normalizedCoverImage || !isValidCoverImage(normalizedCoverImage)) {
      setError('Вкажіть коректне cover image: /img/... або /media/... або https://...');
      return;
    }

    const duplicate = entries.find(
      (entry) => entry.contentType === contentType && entry.slug === normalizedSlug && entry.id !== editingId
    );

    if (duplicate) {
      setError('Стаття з таким slug вже існує в цьому блоці контенту.');
      return;
    }

    const draft = normalizeContentEntry({
      id: editingId ?? `content_${Date.now()}`,
      contentType,
      title: normalizedTitle,
      slug: normalizedSlug,
      excerpt: normalizedExcerpt,
      body: normalizedBody,
      categoryIds,
      coverImage: normalizedCoverImage,
      status,
      updatedAt: new Date().toISOString()
    });

    const next = isEditing
      ? entries.map((entry) => (entry.id === editingId ? draft : entry))
      : [draft, ...entries];

    await persist(next);
    resetForm();
  }

  function handleEdit(entry: ContentEntry) {
    setEditingId(entry.id);
    setContentType(entry.contentType);
    setTitle(entry.title);
    setSlug(entry.slug);
    setIsSlugManual(true);
    setExcerpt(entry.excerpt);
    setBody(entry.body);
    setCategoryIds(entry.categoryIds);
    setIsCategoryMenuOpen(false);
    setCategorySearch('');
    setCoverImage(entry.coverImage);
    setStatus(entry.status);
    setError('');
    setIsSaved(false);
    setExpandedEntryId(entry.id);
    setActiveTab('articles');
  }

  async function handleDelete(entryId: string) {
    const next = entries.filter((entry) => entry.id !== entryId);
    await persist(next);
    if (editingId === entryId) resetForm();
  }

  function getCategoryNames(entry: ContentEntry) {
    const nameMap = new Map(categories.map((category) => [category.id, category.name]));
    return entry.categoryIds.map((id) => nameMap.get(id)).filter(Boolean) as string[];
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Контент</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Контент: статті та категорії</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        В одному модулі ви керуєте матеріалами та категоріями. При створенні статті оберіть блок, категорії та налаштуйте текст у редакторі.
      </p>
      {isLoading ? <p className="mt-2 text-sm font-semibold text-slate-600">Завантаження контенту з БД...</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('articles')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'articles' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 text-slate-700 hover:border-brand hover:text-brand'
          }`}
        >
          Статті
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('categories');
          }}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'categories' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 text-slate-700 hover:border-brand hover:text-brand'
          }`}
        >
          Категорії
        </button>
      </div>

      {activeTab === 'categories' ? (
        <div className="mt-5">
          <AdminBlogCategoriesManager />
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div>
              <label htmlFor="content-type" className="block text-sm font-semibold text-slate-900">Блок контенту</label>
              <select
                id="content-type"
                value={contentType}
                onChange={(event) => {
                  const nextType = event.target.value as ContentType;
                  setContentType(nextType);
                  setCategoryIds((prev) => prev.filter((id) => categories.some((cat) => cat.id === id && categorySupportsContentType(cat, nextType))));
                  setIsCategoryMenuOpen(false);
                  setCategorySearch('');
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              >
                <option value="blog">Блог</option>
                <option value="news">Новини мережі</option>
                <option value="charity">Благодійність</option>
              </select>
            </div>

            <div>
              <label htmlFor="content-title" className="block text-sm font-semibold text-slate-900">Заголовок статті</label>
              <input
                id="content-title"
                value={title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  setTitle(nextTitle);
                  if (!isSlugManual) {
                    setSlug(normalizeSlug(nextTitle));
                  }
                  setIsSaved(false);
                }}
                placeholder="Наприклад: Відкриття нового магазину"
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="content-slug" className="block text-sm font-semibold text-slate-900">Slug</label>
              <input
                id="content-slug"
                value={slug}
                onChange={(event) => {
                  setSlug(normalizeSlug(event.target.value));
                  setIsSlugManual(true);
                  setIsSaved(false);
                }}
                placeholder="avto-z-title-abo-ruchnyj-slug"
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSlug(autoSlug);
                    setIsSlugManual(false);
                    setIsSaved(false);
                  }}
                  className="rounded-full border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                >
                  Оновити з заголовка
                </button>
                <span className="text-slate-500">Авто-варіант: {autoSlug || '—'}</span>
              </div>
              {currentPreviewHref ? (
                <p className="mt-2 text-xs text-slate-600">
                  Посилання на статтю:{' '}
                  <Link href={currentPreviewHref} target="_blank" rel="noreferrer" className="font-semibold text-brand underline underline-offset-2">
                    {currentPreviewHref}
                  </Link>
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="content-excerpt" className="block text-sm font-semibold text-slate-900">Короткий опис</label>
              <textarea
                id="content-excerpt"
                rows={3}
                value={excerpt}
                onChange={(event) => {
                  setExcerpt(event.target.value);
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />
            </div>

            <div>
              <p className="block text-sm font-semibold text-slate-900">Категорії</p>
              <button
                type="button"
                onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
                className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand"
              >
                <span>
                  {selectedCategoryNames.length > 0
                    ? `Вибрано: ${selectedCategoryNames.length}`
                    : 'Оберіть категорії'}
                </span>
                <span className="text-xs text-slate-500">{isCategoryMenuOpen ? 'Згорнути' : 'Розгорнути'}</span>
              </button>

              {selectedCategoryNames.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedCategoryNames.map((item) => (
                    <span key={item} className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}

              {isCategoryMenuOpen ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <input
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    placeholder="Пошук категорії..."
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none transition focus:border-brand"
                  />

                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {filteredAvailableCategories.map((category) => {
                      const checked = categoryIds.includes(category.id);
                      return (
                        <label key={category.id} className="flex items-start gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCategory(category.id)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                          />
                          <span>
                            <span className="font-semibold text-slate-900">{category.name}</span>
                            <span className="block text-xs text-slate-500">{category.slug}</span>
                          </span>
                        </label>
                      );
                    })}
                    {availableCategories.length === 0 ? <p className="text-xs text-slate-500">Немає активних категорій для цього блоку.</p> : null}
                    {availableCategories.length > 0 && filteredAvailableCategories.length === 0 ? (
                      <p className="text-xs text-slate-500">Нічого не знайдено.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <p className="block text-sm font-semibold text-slate-900">Текст статті (редактор)</p>
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">Як працює markdown:</p>
                <ul className="mt-1 space-y-1">
                  <li>{'- `**текст**` -> жирний текст'}</li>
                  <li>{'- `_текст_` -> курсив'}</li>
                  <li>{'- `## Заголовок` / `### Підзаголовок` -> заголовки'}</li>
                  <li>{'- `- пункт` або `1. пункт` -> списки'}</li>
                  <li>{'- `[текст](https://example.com)` -> посилання'}</li>
                  <li>{'- `![alt|w=640|h=360](/img/path.jpg)` -> зображення з керуванням розміром'}</li>
                </ul>
                <p className="mt-2">
                  Логіка кнопок: якщо нічого не виділено, вставляється пара маркерів і курсор стає між ними. Якщо текст виділено, кнопка обгортає його.
                </p>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                {editorActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => insertIntoBody(action)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <textarea
                ref={bodyRef}
                rows={12}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  setIsSaved(false);
                }}
                placeholder="Використовуйте markdown: заголовки, списки, посилання, зображення."
                className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-mono text-sm outline-none transition focus:border-brand"
              />
              <p className="mt-1 text-xs text-slate-600">Кнопки вставляють парні markdown-маркери, курсор стає між відкриваючим і закриваючим. Приклад: `**|**`, `_ |_`, `[]()`.</p>
            </div>

            <div>
              <label htmlFor="content-cover" className="block text-sm font-semibold text-slate-900">Cover image URL</label>
              <input
                id="content-cover"
                value={coverImage}
                onChange={(event) => {
                  setCoverImage(event.target.value);
                  setIsSaved(false);
                }}
                placeholder="/img/..."
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openImageModal}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                >
                  Обрати з сервера
                </button>
                <label className="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand">
                  Завантажити файл
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleCoverUpload(event.target.files?.[0] ?? null);
                    }}
                  />
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="content-status" className="block text-sm font-semibold text-slate-900">Статус</label>
              <select
                id="content-status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as 'draft' | 'published');
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              >
                <option value="draft">Чернетка</option>
                <option value="published">Опубліковано</option>
              </select>
            </div>

            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
            {isSaved ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Статтю збережено.</p> : null}

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
                {isEditing ? 'Зберегти зміни' : 'Додати статтю'}
              </button>
            </div>
          </form>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Список статей</h2>
              <p className="text-xs font-semibold text-slate-600">Усього: {sortedEntries.length}</p>
            </div>

            {sortedEntries.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Статей ще немає.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {sortedEntries.map((entry) => {
                  const coverLocation = getCoverLocation(entry.coverImage);
                  const previewHref = getContentPreviewHref(entry.contentType, entry.slug);
                  return (
                    <li key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{entry.title}</p>
                          <p className="text-xs text-slate-600">{contentTypeLabels[entry.contentType]} • {entry.status === 'published' ? 'Опубліковано' : 'Чернетка'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedEntryId((prev) => (prev === entry.id ? null : entry.id))}
                          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                        >
                          {expandedEntryId === entry.id ? 'Згорнути' : 'Розгорнути'}
                        </button>
                      </div>

                      {expandedEntryId === entry.id ? (
                        <div className="mt-3 space-y-1 border-t border-slate-200 pt-3">
                          <p><span className="font-semibold text-slate-900">Slug:</span> {entry.slug}</p>
                          <p>
                            <span className="font-semibold text-slate-900">Посилання:</span>{' '}
                            <Link
                              href={previewHref}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-brand underline underline-offset-2"
                            >
                              {previewHref}
                            </Link>
                          </p>
                          <p><span className="font-semibold text-slate-900">Опис:</span> {entry.excerpt || '—'}</p>
                          <p><span className="font-semibold text-slate-900">Категорії:</span> {getCategoryNames(entry).join(', ') || '—'}</p>
                          <p>
                            <span className="font-semibold text-slate-900">Cover:</span>{' '}
                            <span
                              title={entry.coverImage || '—'}
                              className="inline-block max-w-full truncate align-bottom"
                            >
                              {formatCoverDisplay(entry.coverImage)}
                            </span>
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Джерело:</span>{' '}
                            {coverLocation.href ? (
                              <a
                                href={coverLocation.href}
                                target="_blank"
                                rel="noreferrer noopener"
                                title={coverLocation.href}
                                className="inline-block max-w-full truncate align-bottom font-semibold text-brand hover:underline"
                              >
                                {coverLocation.label}
                              </a>
                            ) : (
                              <span className="inline-block max-w-full truncate align-bottom" title={coverLocation.label}>
                                {coverLocation.label}
                              </span>
                            )}
                          </p>
                          <p><span className="font-semibold text-slate-900">Текст:</span> {entry.body ? `${entry.body.slice(0, 160)}${entry.body.length > 160 ? '...' : ''}` : '—'}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(entry)}
                              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                            >
                              Редагувати
                            </button>
                            <Link
                              href={previewHref}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-brand/30 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/5"
                            >
                              Переглянути
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id)}
                              className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                            >
                              Видалити
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {isImageModalOpen ? (
        <div className="fixed inset-0 z-[220] bg-slate-900/45 p-4" onClick={() => setIsImageModalOpen(false)}>
          <div
            className="mx-auto mt-6 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:mt-10 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">Зображення з сервера</h2>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
              >
                Закрити
              </button>
            </div>

            <input
              value={imageSearch}
              onChange={(event) => setImageSearch(event.target.value)}
              placeholder="Пошук по шляху /img/..."
              className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
            />

            {isLoadingImages ? <p className="mt-3 text-sm text-slate-600">Завантаження...</p> : null}

            <div className="mt-3 max-h-[60vh] overflow-y-auto">
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleServerImages.map((imagePath) => (
                  <li key={imagePath} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCoverImage(imagePath);
                        setIsSaved(false);
                        setIsImageModalOpen(false);
                      }}
                      className="block w-full text-left"
                    >
                      <div className="mb-2 h-32 overflow-hidden rounded-lg bg-white">
                        <img src={getImagePreviewSrc(imagePath)} alt={imagePath} className="h-full w-full object-cover" />
                      </div>
                      <p className="break-all text-xs text-slate-700">{imagePath}</p>
                    </button>
                  </li>
                ))}
              </ul>
              {!isLoadingImages && visibleServerImages.length === 0 ? <p className="text-sm text-slate-600">Зображення не знайдено.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

