import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

import CareerApplicationForm from '@/components/career-application-form';

export const metadata: Metadata = {
  title: "Кар'єра | Pchilka Market",
  description: "Сторінка кар'єри Pchilka Market: актуальні вакансії та форма відгуку на посаду."
};

async function readVacancies(): Promise<string[]> {
  const filePath = path.join(process.cwd(), 'public', 'img', 'career', 'vacancies.txt');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const normalized = lines.filter((line) => line.toLowerCase() !== 'посада');
    const uniq = Array.from(new Set(normalized));
    return uniq;
  } catch {
    return [];
  }
}

export default async function CareerPage() {
  const vacancies = await readVacancies();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Кар&apos;єра</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Приєднуйтесь до команди Pchilka Market</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-800">
          Оберіть цікаву для вас вакансію зі списку та надішліть заявку через форму нижче.
        </p>

        <CareerApplicationForm vacancies={vacancies} />
      </section>
    </main>
  );
}
