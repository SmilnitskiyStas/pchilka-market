import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';

import { adminSections } from '@/components/admin/admin-sections';
import { getAdminSessionCookieName, getAdminSessionFromToken } from '@/lib/admin-auth';
import { hasAdminPermission, resourceForAdminPath } from '@/lib/admin-permissions';

export const metadata: Metadata = {
  title: 'Адмін-панель | Pchilka Market',
  description: 'Dashboard адмін-панелі Pchilka Market.'
};

export default async function AdminDashboardPage() {
  const sessionToken = (await cookies()).get(getAdminSessionCookieName())?.value;
  const session = getAdminSessionFromToken(sessionToken);
  const allowedSections = adminSections.filter((item) => {
    if (item.href === '/admin') return false;
    return Boolean(session && hasAdminPermission(session.role, session.permissions, resourceForAdminPath(item.href)));
  });

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Панель керування</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        Каркас адмін-панелі готовий. Оберіть модуль для подальшого налаштування.
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {allowedSections.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-sm"
              >
                <p className="text-base font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
