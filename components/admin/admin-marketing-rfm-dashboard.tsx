'use client';

import { useEffect, useState } from 'react';

import type { RfmReport, RfmSegmentDetail } from '@/lib/marketing-rfm';

type Payload = { ok?: boolean; report?: RfmReport; detail?: RfmSegmentDetail; error?: string };
const number = (value: number) => value.toLocaleString('uk-UA');
const money = (value: number) => `${Math.round(value).toLocaleString('uk-UA')} ₴`;

export default function AdminMarketingRfmDashboard() {
  const [days, setDays] = useState(180);
  const [report, setReport] = useState<RfmReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RfmSegmentDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void fetch(`/api/admin/marketing/rfm?days=${days}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() as Payload }))
      .then(({ response, payload }) => { if (!response.ok || !payload.ok || !payload.report) throw new Error(payload.error ?? 'Не вдалося завантажити звіт.'); setReport(payload.report); })
      .catch((e: unknown) => { if (!(e instanceof DOMException && e.name === 'AbortError')) { setReport(null); setError(e instanceof Error ? e.message : 'Не вдалося завантажити звіт.'); } })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [days]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    const controller = new AbortController(); setDetailLoading(true); setDetailError('');
    void fetch(`/api/admin/marketing/rfm/${selected}?days=${days}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() as Payload }))
      .then(({ response, payload }) => { if (!response.ok || !payload.ok || !payload.detail) throw new Error(payload.error ?? 'Не вдалося завантажити сегмент.'); setDetail(payload.detail); })
      .catch((e: unknown) => { if (!(e instanceof DOMException && e.name === 'AbortError')) { setDetail(null); setDetailError(e instanceof Error ? e.message : 'Не вдалося завантажити сегмент.'); } })
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
  }, [days, selected]);

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Маркетинг · локальні дані</p><h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">RFM-аналіз покупців</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Сегментація за давністю останньої покупки, частотою та сумою витрат.</p></div><label className="text-sm font-medium text-slate-700">Період <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900"><option value={90}>90 днів</option><option value={180}>180 днів</option><option value={365}>Рік</option></select></label></div>
    {report ? <p className="mt-4 text-sm text-slate-500">Період: {report.period.from} — {report.period.to}. Оновлено: {new Date(report.generatedAt).toLocaleString('uk-UA')}.</p> : null}
    {loading ? <p className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Розраховую RFM-сегменти…</p> : null}{error ? <p className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</p> : null}
    {report ? <><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Покупці', number(report.totals.customers)], ['Чеки', number(report.totals.orders)], ['Оборот', money(report.totals.turnover)], ['Середній чек', money(report.totals.averageCheck)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>)}</div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]"><section><h2 className="text-lg font-bold text-slate-900">Сегменти</h2><p className="mt-1 text-sm text-slate-500">Натисніть сегмент, щоб відкрити деталізацію.</p><div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Сегмент</th><th className="px-4 py-3 text-right">Покупці</th><th className="px-4 py-3 text-right">Оборот</th><th className="px-4 py-3 text-right">Сер. чек</th></tr></thead><tbody>{report.segments.map((segment) => <tr key={segment.id} className={`border-t border-slate-100 ${selected === segment.id ? 'bg-brand/5' : ''}`}><td className="px-4 py-3"><button type="button" onClick={() => setSelected(segment.id)} className="text-left"><span className="font-semibold text-brand hover:underline">{segment.label}</span><span className="mt-0.5 block max-w-md text-xs text-slate-500">{segment.description}</span></button></td><td className="px-4 py-3 text-right font-medium">{number(segment.customers)}</td><td className="px-4 py-3 text-right">{money(segment.turnover)}</td><td className="px-4 py-3 text-right">{money(segment.averageCheck)}</td></tr>)}</tbody></table></div></section><aside className="rounded-2xl border border-brand/25 bg-brand/5 p-5"><h2 className="text-lg font-bold text-slate-900">Перші рекомендації</h2><ul className="mt-3 space-y-3 text-sm leading-6 text-slate-700">{report.recommendations.map((item) => <li key={item} className="border-b border-brand/10 pb-3 last:border-0 last:pb-0">{item}</li>)}</ul></aside></div>
      {detailLoading ? <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Завантажую деталізацію сегмента…</p> : null}{detailError ? <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{detailError}</p> : null}
      {detail ? <section className="mt-7 rounded-3xl border border-brand/25 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Деталізація сегмента</p><h2 className="mt-1 text-2xl font-bold text-slate-900">{detail.segment.label}</h2><p className="mt-1 text-sm text-slate-600">{detail.segment.description}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Закрити</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Чеків', number(detail.behavior.orders)], ['Чеків / покупця', detail.behavior.ordersPerCustomer.toFixed(1)], ['Сер. давність', `${Math.round(detail.behavior.averageRecencyDays)} дн.`], ['Сер. оборот за період', money(detail.behavior.averageLifetimeValue)], ['Останній візит', detail.behavior.latestVisit ?? '—'], ['Піковий день', detail.behavior.busiestWeekday ?? 'Потребує окремого розрахунку'], ['Пікова година', detail.behavior.busiestHour ?? 'Потребує окремого розрахунку'], ['Сумарний оборот', money(detail.behavior.totalLifetimeValue)]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>)}</div>
        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"><div><h3 className="text-lg font-bold text-slate-900">Топ товарів за охопленням</h3><div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Цей важкий розрахунок винесено з відкриття сегмента. Наступним кроком завантажуватимемо його окремо з оптимізованої локальної вітрини даних.</div></div><div><h3 className="text-lg font-bold text-slate-900">Поведінка покупців</h3><div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Розподіл за днями та годинами також буде завантажуватися окремим легким запитом після підготовки індексованої вітрини.</div></div></div>
        <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/5 p-5"><h3 className="text-lg font-bold text-slate-900">Рекомендація для сегмента</h3><dl className="mt-3 grid gap-3 text-sm">{[['Тригер', detail.recommendation.trigger], ['Дія', detail.recommendation.action], ['Оффер', detail.recommendation.offer], ['Застереження', detail.recommendation.warning]].map(([title, text]) => <div key={title}><dt className="font-semibold text-slate-800">{title}</dt><dd className="mt-1 text-slate-600">{text}</dd></div>)}</dl></div>
      </section> : null}</> : null}
  </div>;
}
