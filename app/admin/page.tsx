import type { Metadata } from 'next';
import Link from 'next/link';

import { adminSections } from '@/components/admin/admin-sections';

export const metadata: Metadata = {
  title: 'РђРґРјС–РЅ-РїР°РЅРµР»СЊ | Pchilka Market',
  description: 'Dashboard Р°РґРјС–РЅ-РїР°РЅРµР»С– Pchilka Market.'
};

export default function AdminDashboardPage() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">РџР°РЅРµР»СЊ РєРµСЂСѓРІР°РЅРЅСЏ</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        РљР°СЂРєР°СЃ Р°РґРјС–РЅ-РїР°РЅРµР»С– РіРѕС‚РѕРІРёР№. РћР±РµСЂС–С‚СЊ РјРѕРґСѓР»СЊ РґР»СЏ РїРѕРґР°Р»СЊС€РѕРіРѕ РЅР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ.
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {adminSections
          .filter((item) => item.href !== '/admin')
          .map((item) => (
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
