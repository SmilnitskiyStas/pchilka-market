import { adminNavigation, flattenAdminNavigation } from '@/lib/admin-navigation';
import { ADMIN_PERMISSION_OPTIONS, hasAdminPermission, resourceForAdminPath } from '@/lib/admin-permissions';

// Derive destinations and section names from the same source as the sidebar.
export function getAdminPermissionGroups() {
  const options = ADMIN_PERMISSION_OPTIONS.filter(({ resource }) => resource !== 'users' && resource !== 'system');
  const sections = adminNavigation.filter((item) => item.children);
  const all = flattenAdminNavigation(adminNavigation);
  return sections.map((section) => ({
    label: section.label,
    modules: options.filter(({ resource }) => sections.find((candidate) => flattenAdminNavigation(candidate.children ?? [])
      .some((page) => resourceForAdminPath(page.href!) === resource)) === section).map((option) => ({
        ...option,
        pages: all.filter((page) => page.href !== '/admin' && hasAdminPermission('editor', [`${option.resource}:read`], resourceForAdminPath(page.href!)))
      }))
  })).filter((section) => section.modules.length > 0);
}
