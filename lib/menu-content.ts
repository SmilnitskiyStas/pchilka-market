import { mainMenu, type MenuItem } from '@/content/menu';
import type { ContentEntry } from '@/lib/content-entries';

export const contentPages = mainMenu.flatMap((item) => [item, ...(item.children ?? [])]).filter((item) => item.href !== '#');
export const legacyContentPaths = { blog: '/blog', news: '/news', charity: '/about/charity' };
export const dedicatedArticlePages = ['/about/why-pchilka-not-bdzhilka'];
export function entryPagePath(entry: ContentEntry): string {
  return entry.pagePath || legacyContentPaths[entry.contentType];
}

// These pages provide tools, files or forms independently of editorial articles.
const functionalPages = new Set(['/', '/about/stores', '/about/contacts', '/about/reporting', '/career', '/promotions', '/promotions/catalog', '/promotions/shock-price', '/loyalty/mobile-app', ...contentPages.filter((page) => page.href.startsWith('/cooperation/')).map((page) => page.href)]);

export function filterContentMenu(menu: MenuItem[], populatedPaths: Set<string>): MenuItem[] {
  return menu.flatMap((item) => {
    const children = item.children ? filterContentMenu(item.children, populatedPaths) : undefined;
    const visible = functionalPages.has(item.href) || populatedPaths.has(item.href);
    if (!visible && !children?.length) return [];
    if (children?.length && populatedPaths.has(item.href) && !children.some((child) => child.href === item.href)) {
      children.unshift({ label: item.label, href: item.href });
    }
    return [{ ...item, href: visible ? item.href : children![0].href, children }];
  });
}
