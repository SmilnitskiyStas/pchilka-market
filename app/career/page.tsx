import type { Metadata } from 'next';
import CareerApplicationForm from '@/components/career-application-form';
import { getCareerTelegramSettings } from '@/lib/career-telegram-settings-repository';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Кар'єра | Pchilka Market",
  description: "Сторінка кар'єри Pchilka Market: актуальні вакансії та форма відгуку на посаду."
};

export default async function CareerPage() {
  const { vacancies } = await getCareerTelegramSettings();

  return (
    <main className="site-container min-h-screen px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Кар&apos;єра</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Приєднуйтесь до команди Pchilka Market</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-800">
          Оберіть цікаву для вас вакансію зі списку та надішліть заявку через форму нижче.
        </p>

        {vacancies.length ? <CareerApplicationForm vacancies={vacancies} /> : (
          <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">Наразі відкритих вакансій немає. Стежте за оновленнями на цій сторінці.</p>
        )}
      </section>
    </main>
  );
}
