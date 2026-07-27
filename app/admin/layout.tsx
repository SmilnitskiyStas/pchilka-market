import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import AdminHeader from '@/components/admin/admin-header';
import AdminNav from '@/components/admin/admin-nav';
import { getAdminSessionCookieName, verifyAdminSessionToken } from '@/lib/admin-auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const requestCookies = await cookies();
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-canonical-path')?.trim();
  const currentPath = !pathname || !pathname.startsWith('/') ? '/admin' : pathname;
  const sessionToken = requestCookies.get(getAdminSessionCookieName())?.value;
  const isAuthorized = verifyAdminSessionToken(sessionToken);

  if (!isAuthorized) {
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
      <main className="min-h-screen w-full px-3 py-4 sm:px-4 sm:py-5 lg:px-5 lg:py-6">
        <AdminHeader />
        <div className="mt-2.5 grid gap-2.5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:self-start">
            <AdminNav />
          </aside>

          <section className="min-w-0 rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-6 lg:p-7">
            {children}
          </section>
        </div>
      </main>
    </>
  );
}
