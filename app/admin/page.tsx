import type { Metadata } from 'next';
import Link from 'next/link';

import { adminSections } from '@/components/admin/admin-sections';

export const metadata: Metadata = {
  title: 'Адмін-панель | Pchilka Market',
  description: 'Dashboard адмін-панелі Pchilka Market.'
};

function buildSectionGroups() {
  const operations = adminSections.filter((item) => item.href.startsWith('/admin/inventory') || item.href === '/admin/network');
  const content = adminSections.filter((item) =>
    ['/admin/content', '/admin/home-slides', '/admin/promotions', '/admin/media', '/admin/own-brand', '/admin/seo'].includes(item.href)
  );
  const system = adminSections.filter((item) =>
    ['/admin/messages', '/admin/integrations', '/admin/users'].includes(item.href)
  );

  return { operations, content, system };
}

function formatToday() {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
}

export default function AdminDashboardPage() {
  const { operations, content, system } = buildSectionGroups();
  const totalModules = adminSections.filter((item) => item.href !== '/admin').length;
  const today = formatToday();

  return (
    <div className="space-y-8">
      <section className="rounded-[1.75rem] border border-black/5 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(245,243,239,0.9))] p-5 shadow-[0_12px_32px_rgba(24,24,18,0.05)] sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Admin Workspace</p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">Панель керування Pchilka</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Починаємо поступовий перехід на новий мінімалістичний дизайн саме з адмінської частини. Тут збережено
              весь поточний функціонал, але оболонка вже стала чистішою, легшою і ближчою до нового інтерфейсу.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-amber-200/70 bg-amber-50/80 px-4 py-4 text-sm text-slate-700">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Today</p>
            <p className="mt-2 font-semibold text-slate-950">{today}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.5rem] border border-red-100 bg-red-50/70 p-5">
          <p className="text-sm text-slate-600">Операційні модулі</p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">{operations.length}</p>
          <p className="mt-2 text-sm text-slate-600">Inventory, магазини, задачі та внутрішні робочі процеси.</p>
        </article>
        <article className="rounded-[1.5rem] border border-amber-100 bg-amber-50/70 p-5">
          <p className="text-sm text-slate-600">Контент і маркетинг</p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">{content.length}</p>
          <p className="mt-2 text-sm text-slate-600">Банери, промо, SEO, медіафайли й публічний контент.</p>
        </article>
        <article className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-5">
          <p className="text-sm text-slate-600">Системні модулі</p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">{system.length}</p>
          <p className="mt-2 text-sm text-slate-600">Користувачі, інтеграції, повідомлення та службові налаштування.</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-[1.75rem] border border-black/5 bg-white p-5 shadow-[0_12px_32px_rgba(24,24,18,0.05)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Quick Access</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Усі модулі</h2>
            </div>
            <span className="rounded-full border border-black/10 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {totalModules}
            </span>
          </div>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {adminSections
              .filter((item) => item.href !== '/admin')
              .map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-[1.4rem] border border-black/5 bg-[linear-gradient(180deg,_#ffffff,_#faf9f6)] p-4 transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_10px_24px_rgba(24,24,18,0.08)]"
                  >
                    <p className="text-base font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </Link>
                </li>
              ))}
          </ul>
        </div>

        <div className="space-y-4">
          <article className="rounded-[1.75rem] border border-black/5 bg-white p-5 shadow-[0_12px_32px_rgba(24,24,18,0.05)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Design Direction</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Новий стиль</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Чистіші поверхні без перевантаження кольором.</li>
              <li>Легкі картки з м’якими межами та великими радіусами.</li>
              <li>Спокійна типографіка з кращим ритмом для довгих адмінських сценаріїв.</li>
              <li>Поступова міграція по розділах без ризику для основного функціоналу.</li>
            </ul>
          </article>

          <article className="rounded-[1.75rem] border border-black/5 bg-slate-950 p-5 text-white shadow-[0_14px_36px_rgba(15,23,42,0.2)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Migration Note</p>
            <h2 className="mt-2 text-2xl font-semibold">Починаємо з admin</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">
              Це хороший безпечний шар для першого редизайну: доступ обмежений, а отже ми можемо спокійно відшліфувати
              нову візуальну мову перед перенесенням у робочі екрани для працівників магазинів.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
