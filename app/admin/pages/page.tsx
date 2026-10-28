import { cookies } from 'next/headers';
import VisualPageEditor from '@/components/admin/visual-page-editor';
import { getAdminSessionCookieName, getCurrentAdminAccessFromToken } from '@/lib/admin-auth';
import { hasAdminPermission } from '@/lib/admin-permissions';

export const metadata = { title: 'Редактор сторінок | Pchilka Market' };
export default async function AdminPages({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const jar = await cookies();
  const session = await getCurrentAdminAccessFromToken(jar.get(getAdminSessionCookieName())?.value);
  const query = await searchParams;
  return <VisualPageEditor initialSlug={query.slug || ''} canWrite={!!session && hasAdminPermission(session.role, session.permissions, 'content', 'write')} />;
}
