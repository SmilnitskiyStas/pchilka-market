export type ShockPriceGalleryItem = {
  id: string;
  title: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
};

export const SHOCK_PRICE_GALLERY_KEY = 'shock_price_gallery_v1';

export function normalizeShockPriceGalleryItem(raw: Partial<ShockPriceGalleryItem> | null | undefined): ShockPriceGalleryItem {
  return {
    id: String(raw?.id ?? `shock_${Date.now()}`),
    title: String(raw?.title ?? '').trim(),
    imageUrl: String(raw?.imageUrl ?? '').trim(),
    isActive: raw?.isActive !== false,
    sortOrder: Number.isFinite(Number(raw?.sortOrder)) ? Number(raw?.sortOrder) : 0,
    updatedAt: String(raw?.updatedAt ?? new Date().toISOString())
  };
}

export function normalizeShockPriceGallery(items: unknown): ShockPriceGalleryItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => normalizeShockPriceGalleryItem(item as Partial<ShockPriceGalleryItem>))
    .filter((item) => item.imageUrl.length > 0);
}
