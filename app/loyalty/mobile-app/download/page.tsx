import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Завантажити застосунок | Pchilka Market',
  description:
    'Окрема сторінка завантаження мобільного застосунку Pchilka Market для Android та iOS.'
};

const ANDROID_URL =
  'https://play.google.com/store/apps/details?id=io.uployal.pchilka&pcampaignid=web_share';
const IOS_URL = 'https://apps.apple.com/ua/app/pchilka/id1602515998';

const PLAY_BADGE_URL =
  'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png';
const APPLE_BADGE_URL = 'https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg';

export default function LoyaltyDownloadPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-8 sm:px-6 sm:py-10">
      <section className="w-full rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:p-8">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <Image src="/img/logo.png" alt="Pchilka Market" width={190} height={62} priority className="h-12 w-auto sm:h-14" />

          <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">Завантажити мобільний застосунок</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Оберіть магазин застосунків для вашого пристрою.
          </p>
        </div>

        <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          <Link
            href={ANDROID_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-brand hover:shadow-sm"
          >
            <p className="mb-2 text-center text-sm font-semibold text-slate-900">Android</p>
            <div className="flex min-h-[96px] flex-1 items-center justify-center">
              <img
                src={PLAY_BADGE_URL}
                alt="Завантажити в Google Play"
                className="mx-auto h-auto w-full max-w-[290px] transition-transform duration-300 group-hover:scale-[1.02]"
                loading="eager"
              />
            </div>
          </Link>

          <Link
            href={IOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-brand hover:shadow-sm"
          >
            <p className="mb-2 text-center text-sm font-semibold text-slate-900">iOS</p>
            <div className="flex min-h-[96px] flex-1 items-center justify-center">
              <img
                src={APPLE_BADGE_URL}
                alt="Download on the App Store"
                className="mx-auto h-auto w-full max-w-[250px] transition-transform duration-300 group-hover:scale-[1.02]"
                loading="eager"
              />
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
