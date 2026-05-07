import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Знижка пенсіонерам | Pchilka Market',
  description:
    'Умови отримання знижки для пенсіонерів у мережі Pchilka Market: хто може скористатися та як підтвердити право на знижку.'
};

const DISCOUNT_PDF_FILE = 'skidka_ukr_compressed.pdf';
const DISCOUNT_PDF_URL = `/img/loyalty_programm/${DISCOUNT_PDF_FILE}`;

async function hasDiscountPdf() {
  const filePath = path.join(process.cwd(), 'public', 'img', 'loyalty_programm', DISCOUNT_PDF_FILE);

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export default async function LoyaltySeniorDiscountPage() {
  const pdfExists = await hasDiscountPdf();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Програма лояльності</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Знижка пенсіонерам</h1>
        <p className="mt-3 max-w-4xl text-sm text-slate-700 sm:text-base">
          На сторінці розміщено офіційний PDF-документ з умовами знижки для пенсіонерів у мережі Pchilka Market.
        </p>

        {pdfExists ? (
          <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Умови знижки</h2>
              <Link
                href={DISCOUNT_PDF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-brand px-4 py-2 text-center text-sm font-semibold text-white transition hover:opacity-90"
              >
                Відкрити PDF
              </Link>
            </div>

            <p className="text-sm text-slate-600">
              Документ: <span className="font-semibold text-slate-900">{DISCOUNT_PDF_FILE}</span>
            </p>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <iframe
                src={`${DISCOUNT_PDF_URL}#view=FitH`}
                title="Умови знижки пенсіонерам"
                className="h-[68vh] min-h-[420px] w-full sm:h-[74vh] sm:min-h-[560px] md:h-[82vh] md:min-h-[680px]"
              />
            </div>
          </section>
        ) : (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            PDF-файл з умовами знижки поки що не знайдено у{' '}
            <span className="font-semibold">public/img/loyalty_programm/{DISCOUNT_PDF_FILE}</span>.
          </p>
        )}
      </section>
    </main>
  );
}
