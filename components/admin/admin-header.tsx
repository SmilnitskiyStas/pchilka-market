'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type AuthMePayload = {
  user?: {
    login?: string;
    role?: string;
  };
};

export default function AdminHeader() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentLogin, setCurrentLogin] = useState('');
  const [currentRole, setCurrentRole] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const response = await fetch('/api/admin/auth/me', { cache: 'no-store' });
        const payload = (await response.json()) as AuthMePayload;

        if (cancelled || !response.ok) return;

        setCurrentLogin(typeof payload.user?.login === 'string' ? payload.user.login : '');
        setCurrentRole(typeof payload.user?.role === 'string' ? payload.user.role : '');
      } catch {
        // The layout has already verified the session; keep the header usable if this request fails.
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login?next=/admin');
      router.refresh();
    }
  }

  return (
    <header className="flex flex-col gap-3 rounded-3xl border border-brand/25 bg-white/95 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Pchilka Market</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Адмін-панель</h1>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-semibold text-slate-900">{currentLogin || 'Користувач адмінки'}</p>
          <p className="mt-0.5 text-xs text-slate-500">{currentRole || 'admin'}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition enabled:hover:border-red-400 enabled:hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
        >
          {isLoggingOut ? 'Вихід...' : 'Вийти'}
        </button>
      </div>
    </header>
  );
}
