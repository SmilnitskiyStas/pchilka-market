import { getSiteMenuSettings } from '@/lib/site-menu-repository';
import { getBlogContentFromDb } from '@/lib/blog-content-repository';
import { filterContentMenu, entryPagePath } from '@/lib/menu-content';
import { blogPosts } from '@/content/blog';
import { newsPosts } from '@/content/news';
import { charityPosts } from '@/content/charity';
import { getPromotionCatalogPages } from '@/lib/promotion-catalog-pages';
import { catalogPageHref } from '@/lib/promotion-catalog-page-types';

export async function getPopulatedMenuPaths() {
  let contentAvailable = true;
  const payload = await getBlogContentFromDb().catch(() => { contentAvailable = false; return { entries: [] }; });
  const paths = new Set(payload.entries.filter((entry) => entry.status === 'published').map(entryPagePath));
  if (blogPosts.length) paths.add('/blog');
  if (newsPosts.length) paths.add('/news');
  if (charityPosts.length) paths.add('/about/charity');
  for (const page of await getPromotionCatalogPages()) if (page.showInList) paths.add(catalogPageHref(page));
  paths.add('/qr-code');
  return { populatedPaths: [...paths], contentAvailable };
}
export async function getPublicSiteMenu() {
  const [settings, content] = await Promise.all([getSiteMenuSettings(), getPopulatedMenuPaths()]);
  return { menu: filterContentMenu(settings.items, new Set(content.populatedPaths)), ...content };
}
