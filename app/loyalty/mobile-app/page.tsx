import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Мобільний застосунок лояльності | Pchilka Market',
  description:
    'Завантажуйте застосунок лояльності Pchilka Market: оберіть версію для Android або iOS, перегляньте правила участі в PDF.'
};

type MobileAppRulesFile = {
  name: string;
  url: string;
};

async function getMobileAppRulesFile(): Promise<MobileAppRulesFile | null> {
  const dirPath = path.join(process.cwd(), 'public', 'img', 'loyalty_programm');

  let entries: Awaited<ReturnType<typeof fs.readdir>> = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const pdfEntry = entries.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'));
  if (!pdfEntry) return null;

  return {
    name: pdfEntry.name,
    url: `/img/loyalty_programm/${encodeURIComponent(pdfEntry.name)}`
  };
}

export default async function LoyaltyMobileAppPage() {
  const rulesFile = await getMobileAppRulesFile();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Програма лояльності</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Мобільний застосунок</h1>
        <p className="mt-3 max-w-4xl text-sm text-slate-700 sm:text-base">
          Оберіть платформу і завантажте застосунок лояльності Pchilka Market, щоб переглядати баланс бонусів та
          отримувати персональні акції.
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm sm:p-3">
          <Image
            src="/img/loyalty_programm/mobile_app_photo.jpg"
            alt="Мобільний застосунок програми лояльності Pchilka Market"
            width={1200}
            height={700}
            className="h-auto w-full rounded-xl object-cover"
            priority
          />
        </div>

        <div className="mt-4">
          <Link
            href="/loyalty/mobile-app/download"
            className="inline-flex rounded-full border border-brand/40 bg-brand/5 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
          >
            Окрема сторінка завантаження
          </Link>
        </div>

        <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Правила участі в мобільному застосунку</h2>
            {rulesFile ? (
              <Link
                href={rulesFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-brand px-4 py-2 text-center text-sm font-semibold text-white transition hover:opacity-90"
              >
                Відкрити PDF
              </Link>
            ) : null}
          </div>

          {rulesFile ? (
            <>
              <p className="text-sm text-slate-600">
                Документ: <span className="font-semibold text-slate-900">{rulesFile.name}</span>
              </p>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <iframe
                  src={`${rulesFile.url}#view=FitH`}
                  title="Правила участі у Програмі лояльності мобільного додатку Пчілка"
                  className="h-[68vh] min-h-[420px] w-full sm:h-[74vh] sm:min-h-[560px] md:h-[82vh] md:min-h-[680px]"
                />
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              PDF-файл правил поки що не знайдено у <span className="font-semibold">public/img/loyalty_programm</span>.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
