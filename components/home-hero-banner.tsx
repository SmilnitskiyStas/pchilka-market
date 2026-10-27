import Link from 'next/link';
import HomeArtwork from '@/components/home-artwork';

export default function HomeHeroBanner() {
  return (
    <section className="home-hero-preview" aria-label="Мобільний застосунок Пчілка">
      <Link href="/loyalty/mobile-app" className="home-hero-banner">
        <div className="home-hero-copy">
          <h2>Мобільний<br /><span>застосунок</span></h2>
          <p>картка у твоєму смартфоні</p>
          <ul><li><span aria-hidden="true">₴</span>Кешбек</li><li><span aria-hidden="true">%</span>Акції</li><li><span aria-hidden="true">☰</span>Відгуки</li></ul>
        </div>
        <div className="home-hero-phone"><HomeArtwork kind="phone" /><span className="home-hero-download">Дізнатися про застосунок ↗</span></div>
      </Link>
      <div className="home-banner-controls" aria-hidden="true"><span className="home-hero-indicator" /></div>
    </section>
  );
}
