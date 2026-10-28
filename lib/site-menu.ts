import { headerMenu, type MenuItem } from '@/content/menu';

export type ManagedMenuItem = Omit<MenuItem, 'id' | 'visibility' | 'children'> & { id: string; visibility: 'auto' | 'always' | 'hidden'; children?: ManagedMenuItem[] };
export type SiteMenuSettings = { items: ManagedMenuItem[] };
export const defaultSiteMenu: SiteMenuSettings = { items: headerMenu.map((item, index) => ({
  label: item.label, href: item.href, id: `menu-${index + 1}`, visibility: 'auto',
  children: item.children?.map((child, childIndex) => ({ label: child.label, href: child.href, id: `menu-${index + 1}-${childIndex + 1}`, visibility: 'auto' }))
})) };

export function normalizeSiteMenu(raw: unknown): SiteMenuSettings {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as SiteMenuSettings).items)) throw new Error('Невірний формат меню.');
  const ids = new Set<string>(); let count = 0;
  function normalize(items: unknown[], depth: number): ManagedMenuItem[] {
    const labels = new Set<string>();
    return items.map((value) => {
      if (++count > 150 || depth > 2 || !value || typeof value !== 'object') throw new Error('Меню може мати до 150 пунктів і два рівні.');
      const item = value as ManagedMenuItem;
      const id = String(item.id ?? '');
      if (!/^[a-z0-9_-]{1,80}$/i.test(id) || ids.has(id)) throw new Error('Ідентифікатори пунктів мають бути унікальними.');
      ids.add(id);
      const label = String(item.label ?? '').trim();
      if (!label || label.length > 100) throw new Error('Назва пункту має містити від 1 до 100 символів.');
      if (labels.has(label.toLowerCase())) throw new Error('Назви пунктів у межах одного рівня мають бути унікальними.');
      labels.add(label.toLowerCase());
      const href = String(item.href ?? '').trim();
      if (!href || href.length > 2000 || /[\s\\\u0000-\u001f]/.test(href)) throw new Error(`Перевірте посилання пункту «${label}».`);
      if (href !== '#' && (!href.startsWith('/') || href.startsWith('//'))) {
        try { const url = new URL(href); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
        catch { throw new Error('Посилання має починатися з / або https://.'); }
      }
      if (item.children !== undefined && !Array.isArray(item.children)) throw new Error('Невірний формат підменю.');
      const children = item.children?.length ? normalize(item.children, depth + 1) : undefined;
      if (href === '#' && !children?.length) throw new Error(`Для пункту «${label}» оберіть сторінку або додайте підменю.`);
      if (item.visibility !== undefined && !['auto', 'always', 'hidden'].includes(item.visibility)) throw new Error('Невірне налаштування видимості.');
      return { id, label, href, visibility: item.visibility || 'auto', ...(children ? { children } : {}) };
    });
  }
  return { items: normalize((raw as SiteMenuSettings).items, 1) };
}

export function moveMenuItem(items: ManagedMenuItem[], id: string, parentId: string | null, position: number): ManagedMenuItem[] {
  const source = items.flatMap((item) => [item, ...(item.children ?? [])]).find((item) => item.id === id);
  if (!source) throw new Error('Пункт не знайдено.');
  const parent = parentId ? items.find((item) => item.id === parentId) : null;
  if (parentId && (!parent || parentId === id || source.children?.length)) throw new Error('Пункт із підменю може бути лише в головному рядку.');
  const next = items.filter((item) => item.id !== id).map((item) => ({ ...item, children: item.children?.filter((child) => child.id !== id) }));
  const destination = parentId ? next.find((item) => item.id === parentId)! : null;
  const list = destination ? (destination.children ??= []) : next;
  list.splice(Math.max(0, Math.min(position, list.length)), 0, source);
  return next;
}
