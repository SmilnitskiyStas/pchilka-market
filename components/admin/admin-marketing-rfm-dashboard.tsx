'use client';

import { useEffect, useState } from 'react';

import type { RfmReport } from '@/lib/marketing-rfm';

type Payload = { ok?: boolean; report?: RfmReport; error?: string };

function number(value: number) {
  return value.toLocaleString('uk-UA');
}

function money(value: number) {
  return `${Math.round(value).toLocaleString('uk-UA')} ₴`;
}

export default function AdminMarketingRfmDashboard() {
  const [days, setDays] = useState(180);
  const [report, setReport] = useState<RfmReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void fetch(`/api/admin/marketing/rfm?days=${days}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() as Payload }))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.ok || !payload.report) throw new Error(payload.error ?? 'Не вдалося завантажити звіт.');
        setReport(payload.report);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setReport(null);
        setError(requestError instanceof Error ? requestError.message : 'Не вдалося завантажити звіт.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [days]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Маркетинг · локальні дані</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">RFM-аналіз покупців</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Сегментація за давністю останньої покупки, частотою та сумою витрат. Дані читаються напряму з локально доступної POS-бази.</p>
        </div>
        <label className="text-sm font-medium text-slate-700">Період
          <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900">
            <option value={90}>Останні 90 днів</option>
            <option value={180}>Останні 180 днів</option>
            <option value={365}>Останній рік</option>
          </select>
        </label>
      </div>

      {report ? <p className="mt-4 text-sm text-slate-500">Період: {report.period.from} — {report.period.to}. Оновлено: {new Date(report.generatedAt).toLocaleString('uk-UA')}.</p> : null}
      {loading ? <p className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Розраховую RFM-сегменти…</p> : null}
      {error ? <p className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</p> : null}

      {report ? <>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Покупці', number(report.totals.customers)], ['Чеки', number(report.totals.orders)],
            ['Оборот', money(report.totals.turnover)], ['Середній чек', money(report.totals.averageCheck)]
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>)}
        </div>
        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
          <section>
            <h2 className="text-lg font-bold text-slate-900">Сегменти</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Сегмент</th><th className="px-4 py-3 text-right">Покупці</th><th className="px-4 py-3 text-right">Оборот</th><th className="px-4 py-3 text-right">Сер. чек</th></tr></thead>
                <tbody>{report.segments.map((segment) => <tr key={segment.id} className="border-t border-slate-100"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{segment.label}</p><p className="mt-0.5 max-w-md text-xs text-slate-500">{segment.description}</p></td><td className="px-4 py-3 text-right font-medium">{number(segment.customers)}</td><td className="px-4 py-3 text-right">{money(segment.turnover)}</td><td className="px-4 py-3 text-right">{money(segment.averageCheck)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
          <aside className="rounded-2xl border border-brand/25 bg-brand/5 p-5"><h2 className="text-lg font-bold text-slate-900">Перші рекомендації</h2><ul className="mt-3 space-y-3 text-sm leading-6 text-slate-700">{report.recommendations.map((item) => <li key={item} className="border-b border-brand/10 pb-3 last:border-0 last:pb-0">{item}</li>)}</ul></aside>
        </div>
      </> : null}
    </div>
  );
}
