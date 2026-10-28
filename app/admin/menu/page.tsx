import type { Metadata } from 'next';
import AdminMenuManager from '@/components/admin/admin-menu-manager';
export const metadata: Metadata = { title: 'Меню сайту | Admin' };
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  return <AdminMenuManager initialHref={query.page || ''} />;
}
