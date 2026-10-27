export type PromotionCatalogPage = {
  id: string;
  title: string;
  slug: string;
  description: string;
  showArchive: boolean;
  showInList: boolean;
};

export const DEFAULT_CATALOG_PAGE_ID = 'f1';

export function catalogPageHref(page: Pick<PromotionCatalogPage, 'slug'>): string {
  return `/promotions/catalog/${page.slug}`;
}
