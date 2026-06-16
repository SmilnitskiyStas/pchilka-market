import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

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
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(248,248,246,0.96)_42%,_rgba(241,239,234,0.94)_100%)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:self-start">
          <AdminNav />
          </aside>

          <section className="min-w-0 overflow-hidden rounded-[2rem] border border-black/5 bg-white/90 shadow-[0_18px_60px_rgba(24,24,18,0.08)] backdrop-blur">
            <div className="border-b border-black/5 bg-[linear-gradient(135deg,_rgba(255,255,255,0.82),_rgba(245,243,239,0.9))] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-[#d97706]" />
                Pchilka Admin
              </div>
            </div>
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </section>
        </div>
      </div>
    </main>
  );
}
