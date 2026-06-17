'use client';

import { useEffect, useMemo, useState } from 'react';

type AssetCategory =
  | 'all'
  | 'images'
  | 'videos'
  | 'pdf'
  | 'banners'
  | 'branding'
  | 'articles'
  | 'other';

type UploadFolderOption = {
  value: string;
  label: string;
};

type AssetMetadata = {
  alt: string;
  title: string;
  caption: string;
  description: string;
  keywords: string;
};

type AssetItem = {
  url: string;
  metadata: AssetMetadata;
};

type AssetsPayload = {
  ok?: boolean;
  assets?: AssetItem[];
  error?: string;
};

type CategoryOption = {
  id: AssetCategory;
  label: string;
};

const categoryOptions: CategoryOption[] = [
  { id: 'all', label: 'Усі файли' },
  { id: 'images', label: 'Фото' },
  { id: 'videos', label: 'Відео' },
  { id: 'pdf', label: 'PDF' },
  { id: 'banners', label: 'Банери' },
  { id: 'branding', label: 'Брендинг' },
  { id: 'articles', label: 'Статті' },
  { id: 'other', label: 'Інше' }
];

const uploadFolderOptions: UploadFolderOption[] = [
  { value: 'branding/logo', label: 'Брендинг / Логотипи' },
  { value: 'branding/icons', label: 'Брендинг / Іконки' },
  { value: 'banners/home', label: 'Банери / Головна' },
  { value: 'promotions/catalogs', label: 'Акції / PDF каталоги' },
  { value: 'promotions/shock-price', label: 'Акції / Шок ціна' },
  { value: 'blog/covers', label: 'Статті / Обкладинки' },
  { value: 'blog/gallery', label: 'Статті / Галерея' },
  { value: 'own-brand', label: 'Власне класне' },
  { value: 'video', label: 'Відео' },
  { value: 'content/misc', label: 'Інше' }
];

const emptyMetadata: AssetMetadata = {
  alt: '',
  title: '',
  caption: '',
  description: '',
  keywords: ''
};

function getFileExtension(assetUrl: string): string {
  const cleanUrl = assetUrl.split('?')[0] ?? assetUrl;
  const lastDot = cleanUrl.lastIndexOf('.');
  if (lastDot === -1) return '';
  return cleanUrl.slice(lastDot).toLowerCase();
}

function isImageAsset(assetUrl: string): boolean {
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg'].includes(getFileExtension(assetUrl));
}

function isVideoAsset(assetUrl: string): boolean {
  return ['.mp4', '.webm', '.mov', '.m4v'].includes(getFileExtension(assetUrl));
}

function isPdfAsset(assetUrl: string): boolean {
  return getFileExtension(assetUrl) === '.pdf';
}

function getCategoryForAsset(assetUrl: string): AssetCategory {
  const normalized = assetUrl.toLowerCase();

  if (normalized.includes('/media/banners/')) return 'banners';
  if (normalized.includes('/media/branding/')) return 'branding';
  if (normalized.includes('/media/blog/')) return 'articles';
  if (isVideoAsset(assetUrl)) return 'videos';
  if (isPdfAsset(assetUrl)) return 'pdf';
  if (isImageAsset(assetUrl)) return 'images';
  return 'other';
}

function getFolderLabel(assetUrl: string): string {
  const normalized = assetUrl.replace(/^\/media\//, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 2) return normalized || '—';
  return parts.slice(0, -3).join(' / ') || normalized;
}

function getFileName(assetUrl: string): string {
  const normalized = assetUrl.split('/').filter(Boolean);
  return normalized[normalized.length - 1] ?? assetUrl;
}

function getCategoryLabel(category: AssetCategory): string {
  return categoryOptions.find((option) => option.id === category)?.label ?? 'Інше';
}

function renderAssetCardPreview(asset: AssetItem) {
  const fileName = getFileName(asset.url);

  if (isImageAsset(asset.url)) {
    return <img src={asset.url} alt={asset.metadata.alt || fileName} className="h-full w-full object-cover" />;
  }

  if (isVideoAsset(asset.url)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-900 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white">
        Video
      </div>
    );
  }

  if (isPdfAsset(asset.url)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-rose-50 text-center text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
        PDF
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      File
    </div>
  );
}

async function fetchAssets(): Promise<AssetItem[]> {
  const response = await fetch('/api/admin/assets', { cache: 'no-store' });
  const payload = (await response.json()) as AssetsPayload;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося завантажити список медіафайлів.');
  }

  return Array.isArray(payload.assets) ? payload.assets : [];
}

async function uploadAsset(file: File, folder: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await fetch('/api/admin/assets', {
    method: 'POST',
    body: formData
  });
  const payload = (await response.json()) as { ok?: boolean; path?: string; error?: string };

  if (!response.ok || !payload.ok || !payload.path) {
    throw new Error(payload.error || 'Не вдалося завантажити файл.');
  }

  return payload.path;
}

async function deleteAsset(assetUrl: string): Promise<void> {
  const response = await fetch('/api/admin/assets', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ path: assetUrl })
  });
  const payload = (await response.json()) as { ok?: boolean; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося видалити файл.');
  }
}

async function saveAssetMetadata(assetUrl: string, metadata: AssetMetadata): Promise<AssetMetadata> {
  const response = await fetch('/api/admin/assets', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ path: assetUrl, metadata })
  });
  const payload = (await response.json()) as { ok?: boolean; metadata?: AssetMetadata; error?: string };

  if (!response.ok || !payload.ok || !payload.metadata) {
    throw new Error(payload.error || 'Не вдалося зберегти SEO-метадані файлу.');
  }

  return payload.metadata;
}

export default function AdminMediaFilesManager() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>(uploadFolderOptions[0]?.value ?? 'content/misc');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedAssetUrl, setSelectedAssetUrl] = useState<string>('');
  const [metadataDraft, setMetadataDraft] = useState<AssetMetadata>(emptyMetadata);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const loadedAssets = await fetchAssets();
        if (cancelled) return;
        setAssets(loadedAssets);
        setSelectedAssetUrl((prev) => prev || loadedAssets[0]?.url || '');
        setError('');
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити список медіафайлів.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesCategory = selectedCategory === 'all' || getCategoryForAsset(asset.url) === selectedCategory;
      const matchesSearch =
        normalizedQuery.length === 0 ||
        asset.url.toLowerCase().includes(normalizedQuery) ||
        getFileName(asset.url).toLowerCase().includes(normalizedQuery) ||
        getFolderLabel(asset.url).toLowerCase().includes(normalizedQuery) ||
        asset.metadata.alt.toLowerCase().includes(normalizedQuery) ||
        asset.metadata.title.toLowerCase().includes(normalizedQuery) ||
        asset.metadata.keywords.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [assets, searchQuery, selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<AssetCategory, number> = {
      all: assets.length,
      images: 0,
      videos: 0,
      pdf: 0,
      banners: 0,
      branding: 0,
      articles: 0,
      other: 0
    };

    assets.forEach((asset) => {
      counts[getCategoryForAsset(asset.url)] += 1;
    });

    return counts;
  }, [assets]);

  const selectedAsset = useMemo(() => assets.find((asset) => asset.url === selectedAssetUrl) ?? null, [assets, selectedAssetUrl]);

  useEffect(() => {
    setMetadataDraft(selectedAsset?.metadata ?? emptyMetadata);
  }, [selectedAsset]);

  const selectedAssetDetails = selectedAsset
    ? {
        url: selectedAsset.url,
        category: getCategoryForAsset(selectedAsset.url),
        fileName: getFileName(selectedAsset.url),
        folderLabel: getFolderLabel(selectedAsset.url),
        isImage: isImageAsset(selectedAsset.url),
        isVideo: isVideoAsset(selectedAsset.url),
        isPdf: isPdfAsset(selectedAsset.url),
        metadata: selectedAsset.metadata
      }
    : null;

  async function handleUpload(file: File | null) {
    if (!file) return;

    setIsUploading(true);
    setError('');
    setSuccess('');
    try {
      const uploadedPath = await uploadAsset(file, selectedFolder);
      const refreshedAssets = await fetchAssets();
      setAssets(refreshedAssets);
      setSelectedAssetUrl(uploadedPath);
      setSuccess(`Файл завантажено: ${uploadedPath}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Не вдалося завантажити файл.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(assetUrl: string) {
    const confirmed = window.confirm(`Видалити файл?\n${assetUrl}`);
    if (!confirmed) return;

    setIsDeleting(true);
    setError('');
    setSuccess('');
    try {
      await deleteAsset(assetUrl);
      const refreshedAssets = await fetchAssets();
      setAssets(refreshedAssets);
      setSelectedAssetUrl((current) => (current === assetUrl ? refreshedAssets[0]?.url ?? '' : current));
      setSuccess(`Файл видалено: ${assetUrl}`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не вдалося видалити файл.');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSaveMetadata() {
    if (!selectedAsset) return;

    setIsSavingMetadata(true);
    setError('');
    setSuccess('');
    try {
      const savedMetadata = await saveAssetMetadata(selectedAsset.url, metadataDraft);
      setAssets((current) =>
        current.map((asset) => (asset.url === selectedAsset.url ? { ...asset, metadata: savedMetadata } : asset))
      );
      setMetadataDraft(savedMetadata);
      setSuccess(`SEO-дані збережено для файлу: ${selectedAsset.url}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти SEO-дані файлу.');
    } finally {
      setIsSavingMetadata(false);
    }
  }

  function updateDraft(field: keyof AssetMetadata, value: string) {
    setMetadataDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Медіафайли</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Медіафайли</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-700 sm:text-base">
            Тут зібрані фото, відео, PDF-файли, банери, бренд-матеріали та інші ресурси, що лежать у керованому сховищі
            <span className="font-semibold"> /media</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Швидке завантаження</p>
          <div className="mt-2 flex flex-col gap-2">
            <select
              value={selectedFolder}
              onChange={(event) => setSelectedFolder(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand"
            >
              {uploadFolderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="rounded-full border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand">
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.json,.svg"
                onChange={(event) => {
                  void handleUpload(event.target.files?.[0] ?? null);
                  event.currentTarget.value = '';
                }}
              />
              {isUploading ? 'Завантаження...' : 'Додати файл'}
            </label>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <label htmlFor="media-search" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
            Пошук
          </label>
          <input
            id="media-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Назва файлу, папка, alt, title або keywords..."
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <div>
          <p className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Категорії</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {categoryOptions.map((option) => {
              const isActive = selectedCategory === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedCategory(option.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-slate-300 text-slate-700 hover:border-brand hover:text-brand'
                  }`}
                >
                  {option.label} ({categoryCounts[option.id]})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {success}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Список файлів</h2>
            <p className="text-xs font-semibold text-slate-500">Знайдено: {filteredAssets.length}</p>
          </div>

          {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження списку медіафайлів...</p> : null}

          {!isLoading && filteredAssets.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              За поточними фільтрами файли не знайдені.
            </p>
          ) : null}

          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAssets.map((asset) => {
              const category = getCategoryForAsset(asset.url);
              const isSelected = asset.url === selectedAssetUrl;

              return (
                <li key={asset.url}>
                  <button
                    type="button"
                    onClick={() => setSelectedAssetUrl(asset.url)}
                    className={`w-full overflow-hidden rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-brand bg-brand/5 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:border-brand/50 hover:bg-white'
                    }`}
                  >
                    <div className="aspect-[4/3] overflow-hidden border-b border-slate-200 bg-white">
                      {renderAssetCardPreview(asset)}
                    </div>

                    <div className="space-y-3 px-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{getFileName(asset.url)}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{asset.url}</p>
                        </div>
                        <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                          {getCategoryLabel(category)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600">Папка: {getFolderLabel(asset.url)}</p>
                      {asset.metadata.alt || asset.metadata.title ? (
                        <p className="line-clamp-2 text-xs text-slate-500">
                          SEO: {[asset.metadata.alt, asset.metadata.title].filter(Boolean).join(' · ')}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">SEO-дані ще не заповнені.</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Перегляд файлу</h2>

          {!selectedAssetDetails ? (
            <p className="mt-4 text-sm text-slate-600">Оберіть файл зі списку ліворуч, щоб побачити деталі.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {selectedAssetDetails.isImage ? (
                  <img
                    src={selectedAssetDetails.url}
                    alt={metadataDraft.alt || selectedAssetDetails.fileName}
                    className="max-h-72 w-full rounded-xl object-contain bg-white"
                  />
                ) : selectedAssetDetails.isVideo ? (
                  <video src={selectedAssetDetails.url} controls className="max-h-72 w-full rounded-xl bg-black" />
                ) : selectedAssetDetails.isPdf ? (
                  <iframe src={selectedAssetDetails.url} title={selectedAssetDetails.fileName} className="h-72 w-full rounded-xl bg-white" />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center text-sm text-slate-500">
                    Прев’ю для цього типу файлу не передбачено.
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">Назва:</span> {selectedAssetDetails.fileName}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Категорія:</span>{' '}
                  {getCategoryLabel(selectedAssetDetails.category)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Папка:</span> {selectedAssetDetails.folderLabel}
                </p>
                <p className="break-all">
                  <span className="font-semibold text-slate-900">URL:</span> {selectedAssetDetails.url}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">SEO-дані файлу</h3>
                  <button
                    type="button"
                    onClick={() => void handleSaveMetadata()}
                    disabled={isSavingMetadata}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingMetadata ? 'Збереження...' : 'Зберегти SEO'}
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Alt</span>
                    <input
                      value={metadataDraft.alt}
                      onChange={(event) => updateDraft('alt', event.target.value)}
                      placeholder="Опис зображення для SEO та accessibility"
                      className="rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-brand"
                    />
                  </label>

                  <label className="grid gap-1 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Title</span>
                    <input
                      value={metadataDraft.title}
                      onChange={(event) => updateDraft('title', event.target.value)}
                      placeholder="Внутрішня SEO-назва файлу"
                      className="rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-brand"
                    />
                  </label>

                  <label className="grid gap-1 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Caption</span>
                    <input
                      value={metadataDraft.caption}
                      onChange={(event) => updateDraft('caption', event.target.value)}
                      placeholder="Короткий підпис під медіафайлом"
                      className="rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-brand"
                    />
                  </label>

                  <label className="grid gap-1 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Description</span>
                    <textarea
                      value={metadataDraft.description}
                      onChange={(event) => updateDraft('description', event.target.value)}
                      placeholder="Розширений опис для карток, статей або банерів"
                      rows={3}
                      className="rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-brand"
                    />
                  </label>

                  <label className="grid gap-1 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Keywords</span>
                    <input
                      value={metadataDraft.keywords}
                      onChange={(event) => updateDraft('keywords', event.target.value)}
                      placeholder="через кому: акція, банер, піца, каталог"
                      className="rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-brand"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={selectedAssetDetails.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
                >
                  Відкрити файл окремо
                </a>
                <button
                  type="button"
                  onClick={() => void handleDelete(selectedAssetDetails.url)}
                  disabled={isDeleting}
                  className="inline-flex rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? 'Видалення...' : 'Видалити файл'}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
