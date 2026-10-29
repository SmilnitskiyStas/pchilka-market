import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Про програму лояльності | Pchilka Market',
  description:
    'Інформація про програму лояльності Pchilka Market: як працює нарахування бонусів, кешбек та переваги для учасників.'
};

export default function LoyaltyAboutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-labelledby="loyalty-title">
        <h1 id="loyalty-title"><span>Мобільний</span><br />застосунок</h1>
        <p className={styles.subtitle}>картка у твоєму смартфоні</p>
        <Link href="/qr-code/" className={styles.download}>завантажити</Link>
        <h2>Ключові можливості для покупця</h2>
        <ul className={styles.features}>
          <li><div className={styles.featureArt}><Image src="/img/loyalty/bonus-card.png" alt="" width={1263} height={1246} sizes="(max-width: 540px) 260px, (max-width: 767px) 30vw, 280px" /></div>Бонусна картка<br />у смартфоні</li>
          <li><div className={styles.featureArt}><Image src="/img/loyalty/cashback.png" alt="" width={1254} height={1254} sizes="(max-width: 540px) 260px, (max-width: 767px) 30vw, 280px" /></div>Можливість отримувати<br />кешбек до 3%</li>
          <li><div className={styles.featureArt}><Image src="/img/loyalty/reviews.png" alt="" width={1448} height={1086} sizes="(max-width: 540px) 260px, (max-width: 767px) 30vw, 280px" /></div>Можливість залишати<br />відгуки</li>
        </ul>
      </section>

      <section className={styles.ranks} aria-labelledby="loyalty-ranks-title">
        <h2 id="loyalty-ranks-title">Ранги</h2>
        <div className={styles.rankGrid}>
          {[
            { name: 'Маленька Пчілка', cashback: '1%', conditions: [['180', 'днів'], ['100', 'покупок'], ['25 000', 'бонусів'], ['20 000', 'грн'], ['5', 'відгуків']] },
            { name: 'Медова Пчілка', cashback: '2%', conditions: [['360', 'днів'], ['200', 'покупок'], ['50 000', 'бонусів'], ['40 000', 'грн'], ['10', 'відгуків']] },
            { name: 'Пчілка Королева', cashback: '3%', conditions: [] }
          ].map((rank, index) => (
            <article key={rank.name} className={styles.rank}>
              <header><div className={styles.rankHeading}><p className={styles.cashback}>{rank.cashback}</p><Image src={`/img/loyalty/rank-${index + 1}.png`} alt="" width={113} height={113} sizes="90px" className={styles.rankIcon} /></div><h3>{rank.name}</h3></header>
              <div className={styles.conditions}>
                {rank.conditions.length ? <ul>{rank.conditions.map(([value, label]) => <li key={label}><strong>{value}</strong> {label}</li>)}</ul> : <p className={styles.highest}><strong>Найвищий ранг!</strong><br /><strong>3%</strong> кешбек</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.bonuses} aria-labelledby="loyalty-bonuses-title">
        <h2 id="loyalty-bonuses-title">Додаткові бонуси для покупців</h2>
        <div className={styles.bonusGrid}>
          <div>
            <h3><strong>+1000</strong> бонусів</h3>
            <ul className={styles.bonusList}><li>за реєстрацію</li><li>в день народження</li></ul>
          </div>
          <div>
            <h3><strong>+ бонуси</strong> за акцію</h3>
            <p>бонуси нараховуються<br />за купівлю акційних товарів</p>
            <p className={styles.conversion}><strong>1 бонус</strong> = 1 копійка<br /><strong>1000 бонусів</strong> = 10 гривень</p>
          </div>
        </div>
        <p className={styles.notice}><span aria-hidden="true">!</span>Бонуси не списуються при купівлі акційних товарів, алкоголю та тютюну</p>
      </section>
    </main>
  );
}
