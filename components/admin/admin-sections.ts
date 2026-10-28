import { adminNavigation, flattenAdminNavigation } from '@/lib/admin-navigation';

export type AdminSection = { href: string; title: string; description: string };

// Compatibility export: the shared navigation is the only module directory.
export const adminSections: AdminSection[] = flattenAdminNavigation(adminNavigation).map((item) => ({
  href: item.href!, title: item.label, description: item.description || item.label
}));
