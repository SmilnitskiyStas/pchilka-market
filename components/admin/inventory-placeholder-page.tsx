import Link from 'next/link';

type InventoryPlaceholderPageProps = {
  title: string;
  description: string;
  path: string;
};

export default function InventoryPlaceholderPage({ title, description, path }: InventoryPlaceholderPageProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Інвентар</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-3 text-sm text-slate-700">{description}</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Сторінка в розробці</p>
          <p className="mt-2 text-sm text-slate-700">
            Тут пізніше буде окрема логіка для цього розділу. Зараз це лише заглушка, щоб меню вже вело на реальний маршрут.
          </p>
          <p className="mt-2 text-xs text-slate-500">Шлях: <span className="font-mono text-slate-700">{path}</span></p>
          <Link
            href="/admin/inventory"
            className="mt-4 inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Повернутися до огляду
          </Link>
        </div>
      </section>
    </div>
  );
}
