import { promises as fs } from 'fs';
import path from 'path';

import { ConfirmDirectionsLink } from '@/components/confirm-directions-link';
import { getSiteProfileFromDb } from '@/lib/site-profile-repository';
import { listStoresFromDb } from '@/lib/stores-repository';

export const dynamic = 'force-dynamic';

type CityStores = {
  city: string;
  addresses: string[];
};

const CITY_PREFIX_REGEX = /^(м\.|с\.|с-ще)\s+/i;

function buildDirectionsUrl(address: string, city: string) {
  const destination = `${address}, ${city}, Україна`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function parseStoresText(raw: string): CityStores[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const result: CityStores[] = [];
  let currentCity: CityStores | null = null;

  for (const line of lines) {
    if (line.toUpperCase() === 'НАШІ МАГАЗИНИ') continue;

    if (CITY_PREFIX_REGEX.test(line)) {
      currentCity = { city: line, addresses: [] };
      result.push(currentCity);
      continue;
    }

    if (!currentCity) continue;
    currentCity.addresses.push(line);
  }

  return result.filter((item) => item.addresses.length > 0);
}

async function readStoresFromTextFile(): Promise<CityStores[]> {
  const infoDir = path.join(process.cwd(), 'public', 'info');
  const fileCandidates = ['our_store.txt', 'our_srote.txt'];

  for (const fileName of fileCandidates) {
    const absolutePath = path.join(infoDir, fileName);
    try {
      const raw = await fs.readFile(absolutePath, 'utf8');
      const parsed = parseStoresText(raw);
      if (parsed.length > 0) return parsed;
    } catch {
      continue;
    }
  }

  return [];
}

async function readStoresFromDb(): Promise<CityStores[]> {
  const stores = await listStoresFromDb();
  const grouped = new Map<string, string[]>();

  stores
    .filter((store) => store.isActive && store.city && store.addressLine)
    .forEach((store) => {
      const list = grouped.get(store.city) ?? [];
      list.push(store.addressLine);
      grouped.set(store.city, list);
    });

  return [...grouped.entries()].map(([city, addresses]) => ({ city, addresses }));
}

export default async function OurStoresPage() {
  let cityStores: CityStores[] = [];
  try {
    cityStores = await readStoresFromDb();
  } catch {
    cityStores = [];
  }
  if (cityStores.length === 0) {
    cityStores = await readStoresFromTextFile();
  }

  const totalStores = cityStores.reduce((total, city) => total + city.addresses.length, 0);

  const profile = await getSiteProfileFromDb().catch(() => null);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Про мережу</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">{profile?.storesPageTitle || 'Наші магазини'}</h1>
        <p className="mt-3 max-w-4xl text-sm text-slate-700 sm:text-base">
          {profile?.storesPageDescription || 'Актуальний список магазинів Pchilka Market за містами та населеними пунктами.'}
          {totalStores > 0 ? <span className="font-semibold"> Усього адрес: {totalStores}.</span> : null}
        </p>

        {profile?.storesMapEmbedUrl ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 sm:text-xl">{profile.storesMapTitle}</h2>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <iframe
                src={profile.storesMapEmbedUrl}
                title={profile.storesMapTitle}
                className="h-[320px] w-full sm:h-[380px] lg:h-[420px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        ) : null}

        {cityStores.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Дані магазинів поки що не знайдено в БД або у файлі <span className="font-semibold">public/info/our_store.txt</span>.
          </p>
        ) : (
          <div className="mt-6 columns-1 gap-4 md:columns-2">
            {cityStores.map((city) => (
              <article
                key={city.city}
                className="mb-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:shadow-lg"
              >
                <h2 className="text-xl font-semibold text-slate-900">{city.city}</h2>
                <p className="mt-1 text-xs text-slate-500">Магазинів: {city.addresses.length}</p>

                <ul className="mt-3 grid gap-1.5 md:grid-cols-2">
                  {city.addresses.map((address) => (
                    <li key={address}>
                      <ConfirmDirectionsLink
                        href={buildDirectionsUrl(address, city.city)}
                        address={`${address}, ${city.city}`}
                        className="group flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/50 hover:bg-white hover:shadow-sm"
                        title="Прокласти маршрут у Google Maps"
                      >
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-brand/40 bg-brand/10 text-brand">
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
                            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V9h1a1 1 0 0 1 1 1v2a3 3 0 0 1-2 2.83V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3.17A3 3 0 0 1 2 12v-2a1 1 0 0 1 1-1h1V7.5Zm2.5-.5a.5.5 0 0 0-.5.5V9h12V7.5a.5.5 0 0 0-.5-.5h-11ZM6 17h12v-2H6v2Zm1-5.5a1 1 0 1 0 0 2h.01a1 1 0 0 0-.01-2Zm10 0a1 1 0 1 0 0 2h.01a1 1 0 0 0-.01-2Z" />
                          </svg>
                        </span>
                        <span className="text-sm text-slate-800 transition-colors group-hover:text-brand">{address}</span>
                      </ConfirmDirectionsLink>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
