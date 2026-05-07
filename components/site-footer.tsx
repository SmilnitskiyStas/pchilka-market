import Link from 'next/link';

import { getSiteProfileFromDb } from '@/lib/site-profile-repository';
import { defaultSiteProfileSettings } from '@/lib/site-profile-settings';

const FOOTER_LINKS = [
  { label: 'Наші магазини', href: '/about/stores' },
  { label: 'Акції', href: '/promotions' },
  { label: 'Каталог акцій', href: '/promotions/catalog' },
  { label: 'Програма лояльності', href: '/loyalty/about' },
  { label: 'Співпраця', href: '/cooperation/offer-product' },
  { label: "Кар'єра", href: '/career' },
  { label: 'Контакти', href: '/about/contacts' }
];

function toTel(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

export default async function SiteFooter() {
  const currentYear = new Date().getFullYear();
  const profile = await getSiteProfileFromDb().catch(() => defaultSiteProfileSettings);

  return (
    <footer className="mt-12 border-t border-brand/25 bg-gradient-to-b from-slate-300/40 via-slate-200/35 to-brand/10 shadow-[inset_0_1px_0_rgba(15,23,42,0.08)]">
      <div className="mx-auto max-w-6xl px-3 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">{profile.companyName}</h2>
            <p className="mt-2 text-sm text-slate-700">
              Мережа магазинів зі щоденними пропозиціями, програмою лояльності та зручною навігацією по магазинах.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Швидкі посилання</h2>
            <ul className="mt-2 space-y-1.5">
              {FOOTER_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm font-medium text-slate-700 transition hover:text-brand">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Контакти</h2>
            <p className="mt-2 text-sm text-slate-700">{profile.contactAddress}</p>
            <a href={`mailto:${profile.contactEmail}`} className="mt-1 block text-sm font-semibold text-brand hover:underline">
              {profile.contactEmail}
            </a>
            <div className="mt-2 space-y-1">
              {profile.contactPhones.map((phone) => (
                <a key={phone} href={`tel:${toTel(phone)}`} className="block text-sm font-semibold text-brand hover:underline">
                  {phone}
                </a>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">© {currentYear} {profile.companyName}. Всі права захищено.</div>
      </div>
    </footer>
  );
}

