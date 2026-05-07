import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import BannerCarousel from '@/components/banner-carousel';
import { latestBlogPosts } from '@/content/blog';
import { defaultHomeBanners } from '@/content/home-banners';
import { parseBannerDateTimeMs } from '@/lib/banner-datetime';
import { listBannersFromDb } from '@/lib/banners-repository';
import { listPublishedEntriesByType } from '@/lib/public-content-repository';
import { listStoresFromDb } from '@/lib/stores-repository';

const promoCards = [
  {
    title: 'Каталог акцій',
    description: 'Гортайте актуальний PDF-каталог і стежте за пропозиціями тижня.',
    href: '/promotions/catalog'
  },
  {
    title: 'Наші магазини',
    description: 'Перевіряйте адреси магазинів і будуйте маршрут у Google Maps.',
    href: '/about/stores'
  },
  {
    title: 'Програма лояльності',
    description: 'Кешбек, правила програми та швидкий перехід до мобільного застосунку.',
    href: '/loyalty/about'
  }
];

const CITY_PREFIX_REGEX = /^(м\.|с\.|с-ще)\s+/i;
const DAILY_VISITORS = '24 500+';
const LOYALTY_MEMBERS = '185 000+';
const VISIBLE_PARTNERS_COUNT = 12;
const PARTNER_BRANDS = ['Milka', 'Coca-Cola', 'Roshen', 'Sandora', 'Nemiroff', 'Моршинська'];
const FAQ_ITEMS = [
  {
    question: 'Як отримати бонуси у програмі лояльності?',
    answer: 'Завантажте застосунок, зареєструйтесь і скануйте покупки для нарахування кешбеку.'
  },
  {
    question: 'Де переглянути актуальні акції?',
    answer: 'У розділі «Акції» доступний PDF-каталог і спеціальні пропозиції мережі.'
  },
  {
    question: 'Як запропонувати співпрацю?',
    answer: 'Перейдіть у меню «Співпраця», оберіть потрібний напрям і заповніть форму.'
  },
  {
    question: 'Як знайти найближчий магазин?',
    answer: 'На сторінці «Наші магазини» доступні всі адреси з кнопкою побудови маршруту.'
  }
];

type NetworkStats = {
  totalStores: number;
  totalCities: number;
};

function isBannerInPublishRange(publishFrom?: string, publishTo?: string): boolean {
  const now = Date.now();
  const fromTs = parseBannerDateTimeMs(publishFrom);
  const toTs = parseBannerDateTimeMs(publishTo);

  if (fromTs !== null && !Number.isNaN(fromTs) && now < fromTs) return false;
  if (toTs !== null && !Number.isNaN(toTs) && now > toTs) return false;
  return true;
}

function parseNetworkStatsFromStores(raw: string): NetworkStats {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let totalStores = 0;
  let totalCities = 0;
  let hasCurrentCity = false;

  for (const line of lines) {
    if (line.toUpperCase() === 'НАШІ МАГАЗИНИ') continue;

    if (CITY_PREFIX_REGEX.test(line)) {
      totalCities += 1;
      hasCurrentCity = true;
      continue;
    }

    if (hasCurrentCity) {
      totalStores += 1;
    }
  }

  return { totalStores, totalCities };
}

async function readNetworkStats(): Promise<NetworkStats> {
  try {
    const dbStores = await listStoresFromDb();
    const activeStores = dbStores.filter((item) => item.isActive && item.city && item.addressLine);
    if (activeStores.length > 0) {
      const uniqueCities = new Set(activeStores.map((item) => item.city));
      return { totalStores: activeStores.length, totalCities: uniqueCities.size };
    }
  } catch {
    // Fallback to text file parsing.
  }

  const infoDir = path.join(process.cwd(), 'public', 'info');
  const fileCandidates = ['our_store.txt', 'our_srote.txt'];

  for (const fileName of fileCandidates) {
    try {
      const raw = await fs.readFile(path.join(infoDir, fileName), 'utf8');
      const parsed = parseNetworkStatsFromStores(raw);
      if (parsed.totalStores > 0) return parsed;
    } catch {
      continue;
    }
  }

  return { totalStores: 0, totalCities: 0 };
}

export default async function HomePage() {
  let activeBanners = defaultHomeBanners;
  try {
    const dbBanners = await listBannersFromDb();
    if (dbBanners.length > 0) activeBanners = dbBanners;
  } catch {
    activeBanners = defaultHomeBanners;
  }

  const bannerSlides = activeBanners
    .filter((banner) => banner.isActive && isBannerInPublishRange(banner.publishFrom, banner.publishTo))
    .map(({ src, alt, href }) => ({ src, alt, href }));
  const networkStats = await readNetworkStats();
  let latestPosts = latestBlogPosts;
  try {
    const entries = await listPublishedEntriesByType('blog');
    if (entries.length > 0) {
      latestPosts = entries.slice(0, 3).map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        excerpt: entry.excerpt,
        publishedAt: new Date(entry.updatedAt).toLocaleDateString('uk-UA'),
        thumbnailImage: entry.coverImage || '/img/logo.png',
        coverImage: entry.coverImage || '/img/logo.png',
        content: []
      }));
    }
  } catch {
    latestPosts = latestBlogPosts;
  }

  const visiblePartners = PARTNER_BRANDS.slice(0, VISIBLE_PARTNERS_COUNT);
  const hiddenPartnersCount = Math.max(0, PARTNER_BRANDS.length - VISIBLE_PARTNERS_COUNT);

  const statCards = [
    { label: 'Магазинів мережі', value: networkStats.totalStores > 0 ? String(networkStats.totalStores) : '—' },
    { label: 'Міст і населених пунктів', value: networkStats.totalCities > 0 ? String(networkStats.totalCities) : '—' },
    { label: 'Клієнтів щодня', value: DAILY_VISITORS },
    { label: 'Учасників програми лояльності', value: LOYALTY_MEMBERS }
  ];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <BannerCarousel slides={bannerSlides} intervalMs={4000} />

      <section className="mt-6 rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:mt-8 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Pchilka Market</p>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl lg:text-4xl">Мережа поруч з вами щодня</h1>
          </div>
          <Link href="/about/stores" className="text-sm font-semibold text-brand hover:underline">
            Переглянути всі магазини
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <article
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:bg-white hover:shadow-lg"
            >
              <p className="text-2xl font-bold text-slate-900 sm:text-3xl">{card.value}</p>
              <p className="mt-1 text-sm text-slate-700">{card.label}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Програма лояльності Pchilka</h2>
          <p className="mt-2 text-sm text-slate-700 sm:text-base">
            Приєднуйтесь до програми лояльності, отримуйте кешбек за покупки та використовуйте переваги мобільного застосунку.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/loyalty/about"
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Детальніше про програму
            </Link>
            <Link
              href="/loyalty/mobile-app"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
            >
              Встановити застосунок
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:mt-8 sm:p-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Чому клієнти обирають Pchilka Market</h2>
          <Link href="/about/contacts" className="text-sm font-semibold text-brand hover:underline">
            Зв'язатися з нами
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:bg-white hover:shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Зручні локації</h3>
            <p className="mt-2 text-sm text-slate-700">Магазини в Києві та області з швидким маршрутом через Google Maps.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:bg-white hover:shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Щотижневі акції</h3>
            <p className="mt-2 text-sm text-slate-700">Актуальні знижки, PDF-каталог і спеціальні пропозиції для постійних клієнтів.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:bg-white hover:shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Лояльність і кешбек</h3>
            <p className="mt-2 text-sm text-slate-700">Мобільний застосунок з бонусами та зручним доступом до правил програми.</p>
          </article>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:mt-8 sm:p-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl lg:text-3xl">Блог: нові статті</h2>
          <Link href="/blog" className="text-sm font-semibold text-brand hover:underline">
            Дивитися всі
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {latestPosts.map((post) => (
            <article
              key={post.slug}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:bg-white hover:shadow-lg"
            >
              <div className="relative h-40 w-full">
                <img src={post.thumbnailImage} alt={post.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </div>

              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{post.publishedAt}</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{post.title}</h3>
                <p className="mt-2 text-sm text-slate-700">{post.excerpt}</p>
                <Link href={`/blog/${post.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
                  Читати статтю
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:mt-8 sm:p-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Наші партнери</h2>
          <Link href="/cooperation/offer-product" className="text-sm font-semibold text-brand hover:underline">
            Стати партнером
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visiblePartners.map((brand) => (
            <article
              key={brand}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:bg-white hover:shadow-lg"
            >
              <p className="text-lg font-semibold text-slate-900">{brand}</p>
            </article>
          ))}
        </div>
        {hiddenPartnersCount > 0 ? (
          <p className="mt-3 text-sm font-semibold text-slate-600">+ ще {hiddenPartnersCount} партнерів</p>
        ) : null}
      </section>

      <section className="mt-6 rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:mt-8 sm:p-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Питання та відповіді</h2>
          <Link href="/about/contacts" className="text-sm font-semibold text-brand hover:underline">
            Поставити запитання
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {FAQ_ITEMS.map((item) => (
            <article
              key={item.question}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:bg-slate-50 hover:shadow-lg"
            >
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{item.question}</h3>
              <p className="mt-2 text-sm text-slate-700 sm:text-base">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {promoCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:shadow-lg"
          >
            <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-700">{card.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
