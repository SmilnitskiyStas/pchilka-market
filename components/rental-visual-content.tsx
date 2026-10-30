import Link from 'next/link';
import { cookies } from 'next/headers';
import { getVisualPage } from '@/lib/visual-pages-repository';
import { getAdminSessionCookieName, getCurrentAdminAccessFromToken } from '@/lib/admin-auth';
import { hasAdminPermission } from '@/lib/admin-permissions';
import VisualPageBody from '@/components/visual-page-body';

export default async function rentalVisualContent(preview: boolean) {
  const jar = await Promise.resolve().then(() => cookies()).catch(() => null);
  const session = await getCurrentAdminAccessFromToken(jar?.get(getAdminSessionCookieName())?.value).catch(() => null);
  const canRead = !!session && hasAdminPermission(session.role, session.permissions, 'content');
  const canWrite = !!session && hasAdminPermission(session.role, session.permissions, 'content', 'write');
  const record = await getVisualPage('rental-intro').catch(() => null);
  const page = preview && canRead ? record?.draft : record?.published;
  return {
    body: page ? <div className="mt-6"><VisualPageBody page={page} /></div> : null,
    toolbar: canWrite ? <aside className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-white p-4 text-sm">
      <span>{preview ? 'Перегляд збереженої чернетки сторінки оренди' : 'Вміст сторінки оренди'}</span>
      <Link href="/admin/pages?slug=rental-intro" className="font-semibold text-brand underline">Редагувати вміст сторінки</Link>
    </aside> : null
  };
}
