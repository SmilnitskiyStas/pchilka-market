'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import {
  readAnalyticsConsent,
  type AnalyticsConsentState,
  writeAnalyticsConsent
} from '@/lib/analytics-consent';

export default function AnalyticsConsentBanner() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsentState>('unset');

  useEffect(() => {
    setConsent(readAnalyticsConsent());
  }, []);

  if ((pathname && (pathname === '/inventory' || pathname.startsWith('/inventory/'))) || consent !== 'unset') return null;

  return (
    <div className="fixed inset-x-0 bottom-3 z-[250] px-3 sm:bottom-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          Ми використовуємо аналітичні cookie для покращення роботи сайту. Дозволити збір аналітичних даних?
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              writeAnalyticsConsent('rejected');
              setConsent('rejected');
            }}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
          >
            Відхилити
          </button>
          <button
            type="button"
            onClick={() => {
              writeAnalyticsConsent('accepted');
              setConsent('accepted');
            }}
            className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Прийняти
          </button>
        </div>
      </div>
    </div>
  );
}
