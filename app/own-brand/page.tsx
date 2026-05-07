import type { Metadata } from 'next';
import Link from 'next/link';

import { ownBrandItems } from '@/content/own-brand';

export const metadata: Metadata = {
  title: 'Власне класне | Pchilka Market',
  description: "Напрями власного виробництва Pchilka Market: копчення, м'ясо та риба, піца і кав'ярня, кулінарія, пекарня, кондитерська."
};

export default function OwnBrandPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Власне класне</p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Напрями власного виробництва</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-700">
          Оберіть потрібний напрям у підменю або зі списку нижче.
        </p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {ownBrandItems.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/own-brand/${item.slug}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 transition hover:border-brand hover:text-brand"
              >
                <p className="text-base font-semibold">{item.title}</p>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
