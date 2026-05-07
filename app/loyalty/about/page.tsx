import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Про програму лояльності | Pchilka Market',
  description:
    'Інформація про програму лояльності Pchilka Market: як працює нарахування бонусів, кешбек та переваги для учасників.'
};

export default function LoyaltyAboutPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Програма лояльності</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Про програму</h1>

        <p className="mt-3 max-w-4xl text-sm text-slate-700 sm:text-base">
          Програма лояльності Pchilka Market дозволяє накопичувати бонуси за покупки та використовувати їх для наступних
          замовлень. Ви отримуєте персональні пропозиції, акції для учасників і зручний контроль балансу в мобільному
          застосунку.
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm sm:p-3">
          <Image
            src="/img/loyalty_programm/loyalty_for_people.jpg"
            alt="Переваги програми лояльності для клієнтів Pchilka Market"
            width={1000}
            height={1600}
            className="mx-auto h-auto w-full max-w-[560px] object-contain"
            priority
          />
        </div>
      </section>
    </main>
  );
}
