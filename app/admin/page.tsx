import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';

import { getAdminNavigation, flattenAdminNavigation } from '@/lib/admin-navigation';
import { getAdminSessionCookieName, getCurrentAdminAccessFromToken } from '@/lib/admin-auth';

export const metadata: Metadata = {
  title: 'Адмін-панель | Pchilka Market',
  description: 'Dashboard адмін-панелі Pchilka Market.'
};

export default async function AdminDashboardPage() {
  const sessionToken = (await cookies()).get(getAdminSessionCookieName())?.value;
  const session = await getCurrentAdminAccessFromToken(sessionToken);
  const groups = session ? getAdminNavigation(session.role, session.permissions).filter((item) => item.children?.length) : [];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Панель керування</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        Оберіть напрям роботи. Розділи згруповані так само, як у боковому меню.
      </p>

      <div className="mt-5 space-y-4">
        {groups.map((group) => <details key={group.id} open={group.id === 'site'} className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold text-slate-900">{group.label} <span className="ml-2 text-xs font-normal text-slate-500">{flattenAdminNavigation(group.children ?? []).length}</span></summary>
          <p className="mt-2 text-sm text-slate-600">{group.description}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">{flattenAdminNavigation(group.children ?? []).map((item) => <li key={item.href}>
            <Link href={item.href!} className="block h-full rounded-xl border border-slate-200 p-3 transition hover:border-brand hover:bg-brand/5">
              <span className="font-semibold text-slate-900">{item.label}</span>
              {item.description ? <p className="mt-1 text-xs text-slate-600">{item.description}</p> : null}
            </Link>
          </li>)}</ul>
        </details>)}
      </div>
    </div>
  );
}
