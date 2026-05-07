import type { Metadata } from 'next';
import Link from 'next/link';

import { getSiteProfileFromDb } from '@/lib/site-profile-repository';
import { defaultSiteProfileSettings } from '@/lib/site-profile-settings';

export const metadata: Metadata = {
  title: 'Контакти | Pchilka Market',
  description: 'Контакти центрального офісу Pchilka Market: адреса, email, телефон та карта проїзду.'
};

function buildMapEmbedUrl(address: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

function buildDirectionsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function lineToNode(line: string, index: number) {
  const emailMatch = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) {
    const email = emailMatch[0];
    return (
      <p key={`${index}_${line}`} className="text-sm text-slate-800 sm:text-base">
        {line.replace(email, '').trim()}{' '}
        <a href={`mailto:${email}`} className="font-semibold text-brand hover:underline">
          {email}
        </a>
      </p>
    );
  }

  const phoneMatch = line.match(/\+?[0-9()\-\s]{7,}/);
  if (phoneMatch) {
    const phoneRaw = phoneMatch[0];
    const phoneLink = phoneRaw.replace(/[^\d+]/g, '');
    return (
      <p key={`${index}_${line}`} className="text-sm text-slate-800 sm:text-base">
        {line.replace(phoneRaw, '').trim()}{' '}
        <a href={`tel:${phoneLink}`} className="font-semibold text-brand hover:underline">
          {phoneRaw}
        </a>
      </p>
    );
  }

  return (
    <p key={`${index}_${line}`} className="text-sm text-slate-800 sm:text-base">
      {line}
    </p>
  );
}

export default async function ContactsPage() {
  const profile = await getSiteProfileFromDb().catch(() => defaultSiteProfileSettings);
  const mapAddress = profile.contactsMapAddress || profile.contactAddress;
  const mapEmbedUrl = buildMapEmbedUrl(mapAddress);
  const directionsUrl = buildDirectionsUrl(mapAddress);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Про мережу</p>
        <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">{profile.contactsPageTitle || 'Контакти'}</h1>

            <div className="mt-6">
              <div className="space-y-2">
                {profile.contactsPageLines.map((line, index) => lineToNode(line, index))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Карта проїзду</h2>
              <Link
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Прокласти маршрут
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <iframe
                src={mapEmbedUrl}
                title="Карта офісу Pchilka Market"
                className="h-[360px] w-full sm:h-[420px] lg:h-[460px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

