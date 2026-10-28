export const MEDIA_CATALOG_PAGE_SIZE = 24;

export function mediaCatalogPage<T>(items: T[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(items.length / MEDIA_CATALOG_PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, requestedPage));
  return { page, pages, items: items.slice((page - 1) * MEDIA_CATALOG_PAGE_SIZE, page * MEDIA_CATALOG_PAGE_SIZE) };
}

// The public image directory can contain spaces, Cyrillic and literal percent
// signs. Preserve existing escaped segments without double-encoding them.
export function mediaPreviewUrl(value: string): string {
  return value.split('/').map((part) => {
    try { return encodeURIComponent(decodeURIComponent(part)); }
    catch { return encodeURIComponent(part); }
  }).join('/');
}
