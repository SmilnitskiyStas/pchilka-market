import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import path from 'path';

import { ConfirmDirectionsLink } from '@/components/confirm-directions-link';
import PizzaMenuGrid, { type PizzaItem } from '@/components/pizza-menu-grid';
import { getOwnBrandItemBySlug, ownBrandItems } from '@/content/own-brand';

type OwnBrandItemPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return ownBrandItems.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: OwnBrandItemPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getOwnBrandItemBySlug(slug);

  if (!item) {
    return {
      title: 'Сторінку не знайдено | Pchilka Market'
    };
  }

  return {
    title: `${item.title} | Власне класне | Pchilka Market`,
    description: item.description
  };
}

type OwnBrandContent = {
  title: string;
  paragraphs: string[];
  videoEmbedUrl: string | null;
};

type PizzaStoreGroup = {
  city: string;
  addresses: string[];
};

type PizzaStoreContent = {
  title: string;
  groups: PizzaStoreGroup[];
};

function toYouTubeEmbedUrl(value: string) {
  const embedMatch = value.match(/https?:\/\/(?:www\.)?youtube\.com\/embed\/[A-Za-z0-9_-]+(?:\?[^"' \n\r<]*)?/i);
  if (embedMatch) return embedMatch[0];

  const watchMatch = value.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]+)/i);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;

  const shortMatch = value.match(/https?:\/\/(?:www\.)?youtu\.be\/([A-Za-z0-9_-]+)/i);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;

  return null;
}

async function readOwnBrandContent(fileName: string): Promise<OwnBrandContent | null> {
  const filePath = path.join(process.cwd(), 'public', 'img', 'own_brand', fileName);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return null;

    const [title, ...rest] = lines;
    const videoEmbedUrl = toYouTubeEmbedUrl(raw);
    const paragraphs = rest.filter((line) => !/<iframe/i.test(line) && !/youtube\.com|youtu\.be/i.test(line));

    return {
      title,
      paragraphs,
      videoEmbedUrl
    };
  } catch {
    return null;
  }
}

function stripHtml(input: string) {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAbsoluteWordPressUrl(src: string) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/')) return `https://pchilka-market.ua${src}`;
  return `https://pchilka-market.ua/${src}`;
}

async function readPizzaStoreContent(): Promise<PizzaStoreContent | null> {
  const filePath = path.join(process.cwd(), 'public', 'img', 'own_brand', 'pizza_and_coffee', 'pizza_store.txt');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return null;

    const [title, ...rest] = lines;
    const groups: PizzaStoreGroup[] = [];
    let current: PizzaStoreGroup | null = null;

    rest.forEach((line) => {
      if (/^(м\.|с\.|с-ще)/i.test(line)) {
        current = { city: line, addresses: [] };
        groups.push(current);
      } else if (current) {
        current.addresses.push(line);
      }
    });

    return { title, groups };
  } catch {
    return null;
  }
}

async function readPizzaList(): Promise<PizzaItem[]> {
  const filePath = path.join(process.cwd(), 'public', 'img', 'own_brand', 'pizza_and_coffee', 'pizza_list.txt');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const chunks = raw.split('<div class="single_pizza">').slice(1);

    const items = chunks
      .map((chunk): PizzaItem | null => {
        const imageMatch = chunk.match(/<img[^>]*src="([^"]+)"/i);
        const h3Match = chunk.match(/<h3>([\s\S]*?)<\/h3>/i);
        const pMatch = chunk.match(/<p>([\s\S]*?)<\/p>/i);

        const h3Raw = h3Match ? h3Match[1] : '';
        const weightMatch = h3Raw.match(/<span>([\s\S]*?)<\/span>/i);
        const weight = weightMatch ? stripHtml(weightMatch[1]) : '';
        const name = stripHtml(h3Raw.replace(/<span>[\s\S]*?<\/span>/i, ''));

        const description = stripHtml(pMatch ? pMatch[1] : '').replace(/^Склад:\s*/i, '').trim();
        const imageUrl = toAbsoluteWordPressUrl(imageMatch ? imageMatch[1].trim() : '');

        if (!name) return null;

        return {
          name,
          weight,
          ingredients: description,
          imageUrl,
          bju: null,
          calories: null
        };
      })
      .filter((item): item is PizzaItem => item !== null);

    return items;
  } catch {
    return [];
  }
}

function createGoogleDirectionsLink(address: string) {
  const destination = address.includes('Україна') ? address : `Україна, ${address}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export default async function OwnBrandItemPage({ params }: OwnBrandItemPageProps) {
  const { slug } = await params;
  const item = getOwnBrandItemBySlug(slug);

  if (!item) {
    notFound();
  }

  const content = item.contentFileName ? await readOwnBrandContent(item.contentFileName) : null;
  const pizzaStores = slug === 'pizza-coffeehouse' ? await readPizzaStoreContent() : null;
  const pizzaItems = slug === 'pizza-coffeehouse' ? await readPizzaList() : [];
  const pageTitle = content?.title ?? item.title;
  const pageParagraphs = content?.paragraphs ?? [item.description];

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Власне класне</p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">{pageTitle}</h1>

        <div className="mt-6 space-y-4">
          {pageParagraphs.map((paragraph, index) => (
            <p key={`${index}_${paragraph.slice(0, 24)}`} className="text-base leading-relaxed text-slate-800">
              {paragraph}
            </p>
          ))}
        </div>

        {item.imageFileName ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Image
              src={`/img/own_brand/${item.imageFileName}`}
              alt={pageTitle}
              width={1024}
              height={548}
              className="h-auto w-full object-cover"
            />
          </div>
        ) : null}

        {content?.videoEmbedUrl ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-black">
            <iframe
              className="aspect-video w-full"
              src={content.videoEmbedUrl}
              title={`${pageTitle} - відео`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        ) : null}

        {slug === 'pizza-coffeehouse' ? (
          <>
            <div className="mt-8">
              <h2 className="text-xl font-bold text-slate-900">Асортимент піци</h2>
              {pizzaItems.length > 0 ? (
                <PizzaMenuGrid items={pizzaItems} />
              ) : (
                <p className="mt-3 text-sm text-slate-600">Список піци поки що не знайдено.</p>
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
              <h2 className="text-xl font-bold text-slate-900">{pizzaStores?.title ?? 'Магазини з піцою'}</h2>
              {pizzaStores && pizzaStores.groups.length > 0 ? (
                <div className="mt-4 columns-1 gap-4 sm:columns-2">
                  {pizzaStores.groups.map((group) => (
                    <section
                      key={group.city}
                      className="mb-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:shadow-lg"
                    >
                      <h3 className="text-base font-semibold text-slate-900">{group.city}</h3>
                      <p className="mt-1 text-xs text-slate-500">Магазинів: {group.addresses.length}</p>

                      <ul className="mt-3 grid gap-1.5 md:grid-cols-2">
                        {group.addresses.map((address) => (
                          <li key={`${group.city}_${address}`} className="text-sm text-slate-700">
                            <ConfirmDirectionsLink
                              href={createGoogleDirectionsLink(`${group.city}, ${address}`)}
                              address={`${group.city}, ${address}`}
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
                    </section>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">Список магазинів поки що не знайдено.</p>
              )}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
