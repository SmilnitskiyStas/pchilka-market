import { promises as fs } from 'fs';
import path from 'path';

import ShockPriceGallery, { type ShockPriceImage } from '@/components/shock-price-gallery';
import { type ShockPriceGalleryItem } from '@/lib/shock-price-gallery';
import { getShockPriceGalleryFromDb } from '@/lib/shock-price-gallery-repository';
import { defaultShockPriceSettings, type ShockPriceSettings } from '@/lib/shock-price-settings';
import { getShockPriceSettingsFromDb } from '@/lib/shock-price-settings-repository';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
export const dynamic = 'force-dynamic';

function toReadableName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '');
}

function applySettings(images: ShockPriceImage[], settings: ShockPriceSettings): ShockPriceImage[] {
  const sorted = [...images];

  switch (settings.sortOrder) {
    case 'oldest':
      sorted.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      break;
    case 'name_asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'uk-UA'));
      break;
    case 'name_desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name, 'uk-UA'));
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
  }

  if (settings.maxItems > 0) {
    return sorted.slice(0, settings.maxItems);
  }

  return sorted;
}

function mapGalleryItemsToImages(items: ShockPriceGalleryItem[]): ShockPriceImage[] {
  return items
    .filter((item) => item.isActive && item.imageUrl.trim().length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      id: item.id,
      name: item.title || `Картка ${item.sortOrder}`,
      url: item.imageUrl,
      updatedAt: item.updatedAt
    }));
}

async function getShockPriceImagesFromFolder(): Promise<ShockPriceImage[]> {
  const imagesDir = path.join(process.cwd(), 'public', 'img', 'shock_price');

  let entries: Awaited<ReturnType<typeof fs.readdir>> = [];
  try {
    entries = await fs.readdir(imagesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const images = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map(async (entry) => {
        const absolutePath = path.join(imagesDir, entry.name);
        const stats = await fs.stat(absolutePath);

        return {
          id: entry.name,
          name: toReadableName(entry.name),
          url: `/img/shock_price/${encodeURIComponent(entry.name)}`,
          updatedAt: stats.mtime.toISOString()
        };
      })
  );

  return images;
}

export default async function ShockPricePage() {
  const [settings, managedGallery] = await Promise.all([
    getShockPriceSettingsFromDb().catch(() => defaultShockPriceSettings),
    getShockPriceGalleryFromDb().catch(() => [])
  ]);

  let images = mapGalleryItemsToImages(managedGallery);

  if (images.length === 0) {
    const folderImages = await getShockPriceImagesFromFolder();
    images = applySettings(folderImages, settings);
  } else if (settings.maxItems > 0) {
    images = images.slice(0, settings.maxItems);
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Акції</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Шок ціна</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700 sm:text-base">
          Актуальні пропозиції зі знижками. Картки і порядок відображення можна керувати з адмін-панелі.
        </p>

        {images.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Поки що немає зображень для блоку «Шок ціна».
          </p>
        ) : (
          <ShockPriceGallery images={images} settings={settings} />
        )}
      </section>
    </main>
  );
}
