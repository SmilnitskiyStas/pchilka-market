import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import AdminHeader from '@/components/admin/admin-header';
import AdminNav from '@/components/admin/admin-nav';
import AdminAccessGuard from '@/components/admin/admin-access-guard';
import { getAdminSessionCookieName, getAdminSessionFromToken } from '@/lib/admin-auth';
import { hasAdminPermission, resourceForAdminPath } from '@/lib/admin-permissions';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const requestCookies = await cookies();
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-canonical-path')?.trim();
  const currentPath = !pathname || !pathname.startsWith('/') ? '/admin' : pathname;
  const sessionToken = requestCookies.get(getAdminSessionCookieName())?.value;
  const session = getAdminSessionFromToken(sessionToken);
  if (!session || !hasAdminPermission(session.role, session.permissions, resourceForAdminPath(currentPath))) {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body > header {
              display: none !important;
            }
          `
        }}
      />
      <main className="min-h-screen w-full px-3 pb-4 pt-1 sm:px-4 sm:pb-5 sm:pt-1 lg:px-5 lg:pb-6">
        <AdminHeader />
        <div className="mt-2.5 grid gap-2.5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:self-start">
            <AdminNav />
          </aside>

          <AdminAccessGuard role={session.role} permissions={session.permissions}>
            <section className="min-w-0 rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-6 lg:p-7">
              {children}
            </section>
          </AdminAccessGuard>
        </div>
      </main>
    </>
  );
}
