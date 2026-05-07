'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { ShockPriceGalleryItem } from '@/lib/shock-price-gallery';

type SourceMode = 'path' | 'upload' | 'library';
type ImagesPayload = { images?: string[] };

function normalizeItems(items: ShockPriceGalleryItem[]): ShockPriceGalleryItem[] {
  return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
}

function imageNameFromPath(path: string) {
  const fileName = path.split('/').pop() ?? path;
  return decodeURIComponent(fileName).replace(/\.[^.]+$/, '');
}

async function fetchGallery(): Promise<ShockPriceGalleryItem[]> {
  const response = await fetch('/api/admin/shock-price/gallery', { cache: 'no-store' });
  const payload = (await response.json()) as { ok?: boolean; items?: ShockPriceGalleryItem[]; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося завантажити картки «Шок ціна».');
  }

  return Array.isArray(payload.items) ? normalizeItems(payload.items) : [];
}

async function saveGallery(items: ShockPriceGalleryItem[]): Promise<ShockPriceGalleryItem[]> {
  const response = await fetch('/api/admin/shock-price/gallery', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: normalizeItems(items) })
  });

  const payload = (await response.json()) as { ok?: boolean; items?: ShockPriceGalleryItem[]; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося зберегти картки «Шок ціна».');
  }

  return Array.isArray(payload.items) ? normalizeItems(payload.items) : [];
}

export default function AdminShockPriceManager() {
  const [items, setItems] = useState<ShockPriceGalleryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [sourceMode, setSourceMode] = useState<SourceMode>('path');
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [libraryImages, setLibraryImages] = useState<string[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);

  const visibleLibraryImages = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    if (!query) return libraryImages;
    return libraryImages.filter((item) => item.toLowerCase().includes(query));
  }, [libraryImages, librarySearch]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [gallery, imagesResponse] = await Promise.all([
          fetchGallery(),
          fetch('/api/admin/images', { cache: 'no-store' })
        ]);

        if (cancelled) return;
        setItems(gallery);

        const imagesPayload = (await imagesResponse.json()) as ImagesPayload;
        if (Array.isArray(imagesPayload.images)) {
          setLibraryImages(imagesPayload.images);
        }
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : 'Не вдалося завантажити блок «Шок ціна».';
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
    setTitle('');
    setImageUrl('');
    setIsActive(true);
    setSourceMode('path');
  }

  async function handleUpload(file: File | null) {
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'admin/promotions/shock-price');

      const response = await fetch('/api/admin/images', { method: 'POST', body: formData });
      const payload = (await response.json()) as { ok?: boolean; path?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.path) {
        throw new Error(payload.error || 'Не вдалося завантажити файл.');
      }

      setImageUrl(payload.path);
      setLibraryImages((prev) => Array.from(new Set([payload.path!, ...prev])));
      setSourceMode('path');
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Не вдалося завантажити файл.';
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  function handleAddCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const normalizedImageUrl = imageUrl.trim();
    if (!normalizedImageUrl) {
      setError('Вкажіть або оберіть зображення для картки.');
      return;
    }

    const next: ShockPriceGalleryItem[] = normalizeItems([
      ...items,
      {
        id: `shock_card_${Date.now()}`,
        title: title.trim(),
        imageUrl: normalizedImageUrl,
        isActive,
        sortOrder: items.length + 1,
        updatedAt: new Date().toISOString()
      }
    ]);

    setItems(next);
    resetForm();
  }

  function moveItem(itemId: string, direction: 'up' | 'down') {
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const next = [...items];
    const [picked] = next.splice(index, 1);
    next.splice(targetIndex, 0, picked);
    setItems(normalizeItems(next));
  }

  function updateItem(itemId: string, patch: Partial<ShockPriceGalleryItem>) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, ...patch, updatedAt: new Date().toISOString() }
          : item
      )
    );
  }

  function removeItem(itemId: string) {
    setItems((prev) => normalizeItems(prev.filter((item) => item.id !== itemId)));
  }

  async function handleSaveAll() {
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const saved = await saveGallery(items);
      setItems(saved);
      setSuccess('Картки «Шок ціна» та порядок збережено.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Не вдалося зберегти картки.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Картки «Шок ціна»: зображення та порядок</h2>
      <p className="mt-2 text-sm text-slate-600">
        Додавайте картки, змінюйте порядок і вмикайте/вимикайте показ.
      </p>

      {isLoading ? <p className="mt-3 text-sm text-slate-600">Завантаження...</p> : null}

      <form onSubmit={handleAddCard} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSourceMode('path')}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              sourceMode === 'path' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 text-slate-700'
            }`}
          >
            Шлях/URL
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceMode('library');
              setIsLibraryModalOpen(true);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              sourceMode === 'library' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 text-slate-700'
            }`}
          >
            Обрати з сервера
          </button>
          <button
            type="button"
            onClick={() => setSourceMode('upload')}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              sourceMode === 'upload' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 text-slate-700'
            }`}
          >
            Завантажити файл
          </button>
        </div>

        <div>
          <label htmlFor="shock-card-url" className="block text-sm font-semibold text-slate-900">URL зображення</label>
          <input
            id="shock-card-url"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="/img/shock_price/file.jpg або /media/..."
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        {sourceMode === 'upload' ? (
          <div>
            <label htmlFor="shock-card-upload" className="block text-sm font-semibold text-slate-900">Файл зображення</label>
            <input
              id="shock-card-upload"
              type="file"
              accept="image/*"
              onChange={(event) => {
                void handleUpload(event.target.files?.[0] ?? null);
              }}
              className="mt-1.5 block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-semibold file:text-brand hover:file:bg-brand/20"
            />
            {uploading ? <p className="mt-1 text-xs text-slate-500">Завантаження файлу...</p> : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="shock-card-title" className="block text-sm font-semibold text-slate-900">Назва картки (необов'язково)</label>
          <input
            id="shock-card-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          Активна картка
        </label>

        <button
          type="submit"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Додати картку
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">Порядок карток</h3>
        <button
          type="button"
          onClick={() => void handleSaveAll()}
          disabled={isSaving}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:opacity-60"
        >
          {isSaving ? 'Збереження...' : 'Зберегти порядок і картки'}
        </button>
      </div>

      <ul className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <div className="h-24 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <img src={item.imageUrl} alt={item.title || item.imageUrl} className="h-full w-full object-contain" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">#{index + 1}</p>
                <input
                  value={item.title}
                  onChange={(event) => updateItem(item.id, { title: event.target.value })}
                  placeholder="Назва картки"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none transition focus:border-brand"
                />
                <input
                  value={item.imageUrl}
                  onChange={(event) => updateItem(item.id, { imageUrl: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none transition focus:border-brand"
                />
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={item.isActive}
                    onChange={(event) => updateItem(item.id, { isActive: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  Активна
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, 'up')}
                    disabled={index === 0}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold disabled:opacity-40"
                  >
                    Вгору
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, 'down')}
                    disabled={index === items.length - 1}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold disabled:opacity-40"
                  >
                    Вниз
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700"
                  >
                    Видалити
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 && !isLoading ? (
        <p className="mt-3 text-sm text-slate-600">Карток ще немає. Додайте першу картку вище.</p>
      ) : null}

      {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
      {success ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}

      {isLibraryModalOpen ? (
        <div className="fixed inset-0 z-[220] bg-slate-900/45 p-4" onClick={() => setIsLibraryModalOpen(false)}>
          <div
            className="mx-auto mt-4 w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:mt-8 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">Оберіть зображення з сервера</h3>
              <button
                type="button"
                onClick={() => setIsLibraryModalOpen(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                Закрити
              </button>
            </div>

            <input
              value={librarySearch}
              onChange={(event) => setLibrarySearch(event.target.value)}
              placeholder="Пошук по /img або /media"
              className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
            />

            <div className="mt-3 max-h-[60vh] overflow-y-auto">
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleLibraryImages.map((path) => (
                  <li key={path} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl(path);
                        if (!title.trim()) setTitle(imageNameFromPath(path));
                        setSourceMode('path');
                        setIsLibraryModalOpen(false);
                      }}
                      className="block w-full text-left"
                    >
                      <div className="mb-2 h-36 overflow-hidden rounded-lg bg-white">
                        <img src={path} alt={path} className="h-full w-full object-contain" />
                      </div>
                      <p className="break-all text-xs text-slate-700">{path}</p>
                    </button>
                  </li>
                ))}
              </ul>
              {visibleLibraryImages.length === 0 ? (
                <p className="text-sm text-slate-600">Зображення не знайдено.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
