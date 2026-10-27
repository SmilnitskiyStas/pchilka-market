import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import BannerCarousel from '@/components/banner-carousel';
import HomeArtwork from '@/components/home-artwork';
import HomeHeroBanner from '@/components/home-hero-banner';
import type { HomeBanner } from '@/content/home-banners';
import { isBannerInPublishRange } from '@/lib/banner-datetime';
import { listBannersFromDb } from '@/lib/banners-repository';
import { listStoresFromDb } from '@/lib/stores-repository';

export const dynamic = 'force-dynamic';

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
  let activeBanners: HomeBanner[] = [];
  try {
    activeBanners = await listBannersFromDb();
  } catch {
    // Show the mobile-app preview when configured banners are unavailable.
  }

  const bannerSlides = activeBanners
    .filter((banner) => banner.isActive && isBannerInPublishRange(banner.publishFrom, banner.publishTo))
    .map(({ id, src, alt, href }) => ({ id, src, alt, href }));
  const networkStats = await readNetworkStats();
  const statCards = [
    { label: 'Магазинів мережі', value: networkStats.totalStores > 0 ? String(networkStats.totalStores) : '—' },
    { label: 'Міст і населених пунктів', value: networkStats.totalCities > 0 ? String(networkStats.totalCities) : '—' },
    { label: 'Клієнтів щодня', value: DAILY_VISITORS },
    { label: 'Учасників програми лояльності', value: LOYALTY_MEMBERS }
  ];

  return (
    <main className="home-page">
      <div className="home-frame home-intro">
        {bannerSlides.length > 0 ? <BannerCarousel slides={bannerSlides} intervalMs={4000} /> : <HomeHeroBanner />}
        <h1 className="sr-only">Пчілка маркет — купуй вигідно та зручно</h1>
        <section className="home-promo-grid" aria-label="Популярні розділи">
          {promoCards.map((card, index) => <Link key={card.href} href={card.href} className="home-promo-card">
            <div className="home-promo-copy"><h2>{card.title}</h2><p>{card.description}</p></div>
            <div className="home-promo-art"><HomeArtwork kind={index === 0 ? 'catalog' : index === 1 ? 'pin' : 'phone'} /></div>
          </Link>)}
        </section>
      </div>
      <section className="home-network" aria-labelledby="home-network-title">
        <div className="home-frame">
          <h2 id="home-network-title" className="home-section-title">Купуй вигідно та <span>зручно</span></h2>
          <div className="home-stats-grid">
            {statCards.map((card) => <article key={card.label} className="home-stat"><p>{card.value}</p><h3>{card.label}</h3></article>)}
          </div>
          <div className="home-network-gallery" aria-label="Переваги мережі">
            {([{ kind: 'store', href: '/about/stores', label: 'Магазини поруч' }, { kind: 'map', href: '/about/stores', label: 'Зручні локації' }, { kind: 'shopping', href: '/promotions/catalog', label: 'Вигідні покупки' }, { kind: 'rewards', href: '/loyalty/about', label: 'Лояльність і кешбек' }] as const).map((item) => <Link key={item.kind} href={item.href} className={`home-network-picture home-network-picture-${item.kind}`}><HomeArtwork kind={item.kind} /><span>{item.label}</span></Link>)}
          </div>
        </div>
      </section>
      <section className="home-frame home-loyalty" aria-labelledby="home-loyalty-title">
        <h2 id="home-loyalty-title" className="home-section-title">Програма лояльності <span>Пчілка</span></h2>
        <p className="home-section-description">Приєднуйтесь до програми лояльності, отримуйте кешбек за покупки та використовуйте переваги мобільного застосунку.</p>
        <Link href="/loyalty/mobile-app" className="home-app-presentation" aria-label="Мобільний застосунок Пчілка">
          <div className="home-app-copy"><p>Мобільний<br /><span>застосунок</span></p><strong>картка у твоєму смартфоні</strong><ul><li>Кешбек</li><li>Акції</li><li>Відгуки</li></ul></div>
          <HomeArtwork kind="phone" />
        </Link>
        <Link href="/loyalty/about" className="home-primary-button">Детальніше про програму</Link>
      </section>
      <section className="home-frame home-faq" aria-labelledby="home-faq-title">
        <h2 id="home-faq-title" className="home-section-title">Питання та <span>відповіді</span></h2>
        <div className="home-faq-grid">
          {FAQ_ITEMS.map((item) => <article key={item.question} className="home-faq-card"><span aria-hidden="true">?</span><div><h3>{item.question}</h3><p>{item.answer}</p></div></article>)}
        </div>
      </section>
    </main>
  );
}
