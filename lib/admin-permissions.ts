export const ADMIN_RESOURCES = [
  'dashboard',
  'content',
  'banners',
  'promotions',
  'media',
  'network',
  'messages',
  'own_brand',
  'seo',
  'integrations',
  'marketing',
  'telegram',
  'career_telegram',
  'training',
  'inventory',
  'utility_meters',
  'users',
  'system'
] as const;

export type AdminResource = (typeof ADMIN_RESOURCES)[number];
export type AdminAction = 'read' | 'write' | 'delete';
export type AdminPermission = `${AdminResource}:${AdminAction}`;

export const ADMIN_PERMISSION_OPTIONS: Array<{ resource: AdminResource; label: string }> = [
  { resource: 'content', label: 'Сторінки, статті, меню та співпраця' },
  { resource: 'banners', label: 'Банери' },
  { resource: 'promotions', label: 'Акції' },
  { resource: 'media', label: 'Медіафайли' },
  { resource: 'network', label: 'Магазини та контакти' },
  { resource: 'messages', label: 'Повідомлення і заявки' },
  { resource: 'own_brand', label: 'Власне виробництво' },
  { resource: 'seo', label: 'SEO' },
  { resource: 'integrations', label: 'Інтеграції' },
  { resource: 'marketing', label: 'Маркетингова аналітика' },
  { resource: 'telegram', label: 'Telegram-боти: спільний доступ (сумісність)' },
  { resource: 'career_telegram', label: 'Бот вакансій' },
  { resource: 'training', label: 'Навчання та тести' },
  { resource: 'inventory', label: 'Інвентар' },
  { resource: 'utility_meters', label: 'Комунальні нарахування' },
  { resource: 'users', label: 'Користувачі та доступи' },
  { resource: 'system', label: 'Системні налаштування' }
];

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === 'string' && /^([a-z_]+):(read|write|delete)$/.test(value) && ADMIN_RESOURCES.some((resource) => value.startsWith(`${resource}:`));
}

export function normalizeAdminPermissions(value: unknown): AdminPermission[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isAdminPermission))];
}

export function hasAdminPermission(
  role: 'admin' | 'editor',
  permissions: readonly AdminPermission[],
  resource: AdminResource,
  action: AdminAction = 'read'
): boolean {
  if (role === 'admin') return true;
  if (resource === 'dashboard' && permissions.length > 0) return true;
  // Preserve access for accounts assigned the original shared Telegram permission.
  if (resource === 'career_telegram' && hasAdminPermission(role, permissions, 'telegram', action)) return true;
  if (permissions.includes(`${resource}:${action}`)) return true;
  return action === 'read' && (permissions.includes(`${resource}:write`) || permissions.includes(`${resource}:delete`));
}

export function resourceForAdminPath(pathname: string): AdminResource {
  if (pathname.includes('/engineering')) return 'system';
  if (pathname === '/admin' || pathname === '/api/admin/auth/me') return 'dashboard';
  if (pathname.includes('/users')) return 'users';
  if (pathname.includes('/utility-meters') || pathname.includes('/utility_meters')) return 'utility_meters';
  if (pathname.includes('/inventory/settings/')) return 'system';
  if (pathname.includes('/inventory')) return 'inventory';
  if (pathname.includes('/product-info')) return 'inventory';
  if (pathname.includes('/messages')) return 'messages';
  if (pathname.includes('/home-slides') || pathname.includes('/banners')) return 'banners';
  if (pathname.includes('/promotions') || pathname.includes('/promotion-catalogs') || pathname.includes('/shock-price')) return 'promotions';
  if (pathname.includes('/media') || pathname.includes('/assets') || pathname.includes('/images') || pathname.includes('/video-optimization')) return 'media';
  if (pathname.includes('/network') || pathname.includes('/stores') || pathname.includes('/site-profile')) return 'network';
  if (pathname.includes('/seo')) return 'seo';
  if (pathname.includes('/integrations')) return 'integrations';
  if (pathname.includes('/marketing')) return 'marketing';
  if (pathname.includes('/career-telegram')) return 'career_telegram';
  if (pathname.includes('/fun-telegram')) return 'telegram';
  if (pathname.includes('/training')) return 'training';
  if (pathname.includes('/own-brand')) return 'own_brand';
  if (pathname.includes('/content') || pathname.includes('/blog') || pathname.includes('/cooperation') || pathname.includes('/menu') || pathname === '/admin/pages' || pathname === '/api/admin/pages') return 'content';
  return 'system';
}

export function actionForHttpMethod(method: string): AdminAction {
  if (method === 'DELETE') return 'delete';
  return method === 'GET' || method === 'HEAD' ? 'read' : 'write';
}
