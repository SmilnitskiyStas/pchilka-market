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
    if (item.visibility === 'hidden') return [];
    const children = item.children ? filterContentMenu(item.children, populatedPaths) : undefined;
    const pathname = item.href.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    const visible = item.href !== '#' && (item.visibility === 'always' || /^https:\/\//.test(item.href) || functionalPages.has(pathname) || populatedPaths.has(pathname));
    if (!visible && !children?.length) return [];
    if (item.href !== '#' && children?.length && (populatedPaths.has(pathname) || item.visibility === 'always') && !children.some((child) => child.href === item.href)) {
      children.unshift({ id: item.id ? `${item.id}-overview` : undefined, label: item.label, href: item.href });
    }
    return [{ ...item, href: visible ? item.href : children![0].href, children }];
  });
}
