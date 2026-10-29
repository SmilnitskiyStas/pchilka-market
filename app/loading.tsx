export default function Loading() {
  return (
    <main className="site-container min-h-[50vh] px-4 py-10 sm:px-6 lg:px-8" role="status" aria-live="polite" aria-label="Завантаження сторінки">
      <p className="mb-6 text-sm font-medium text-slate-600">Завантажуємо сторінку…</p>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="h-8 w-2/3 max-w-md rounded-xl bg-brand/10" />
        <div className="h-4 w-full max-w-2xl rounded-lg bg-slate-100" />
        <div className="h-4 w-4/5 max-w-xl rounded-lg bg-slate-100" />
        <div className="mt-6 h-48 rounded-3xl border border-brand/15 bg-white/80" />
      </div>
    </main>
  );
}
