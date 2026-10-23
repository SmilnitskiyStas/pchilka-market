'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type CodeRow = { id: number; campaignKey: string; codeValue: string; status: 'available' | 'issued'; issuedAt: string | null; lastPresentedAt: string | null; loyaltyCode: string | null; checkTotal: number | null; orderCode: string | null; storeCode: string | null; workplaceId: string | null; ruleCode: number | null; createdAt: string };
type Pagination = { page: number; pageSize: number; total: number; totalPages: number; query: string };
type Payload = { ok?: boolean; summary?: { total: number; available: number; issued: number; lastPresentedAt: string | null }; rows?: CodeRow[]; pagination?: Pagination; error?: string };

const number = (value: unknown) => Number(value || 0).toLocaleString('uk-UA');
const money = (value: unknown) => Number(value || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';

export default function AdminMegogoCodes() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Payload>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  async function load(page = 1, query = appliedSearch) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query) params.set('q', query);
      const response = await fetch(`/api/admin/marketing/megogo-codes?${params.toString()}`, { cache: 'no-store' });
      const json = await response.json() as Payload;
      if (!response.ok || !json.ok) throw new Error(json.error || 'Не вдалося завантажити дані.');
      setData(json);
    } catch (error) {
      setData({ error: error instanceof Error ? error.message : 'Не вдалося завантажити дані.' });
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchText.trim();
    setAppliedSearch(query);
    void load(1, query);
  }

  async function upload(file: File) {
    setUploading(true);
    setUploadStatus('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/admin/marketing/megogo-codes', { method: 'POST', body });
      const result = await response.json() as { ok?: boolean; added?: number; alreadyExists?: number; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося додати коди.');
      setUploadStatus(`Додано кодів: ${number(result.added)}. Уже були у списку: ${number(result.alreadyExists)}.`);
      if (inputRef.current) inputRef.current.value = '';
      await load(1, appliedSearch);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : 'Не вдалося додати коди.');
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => { void load(1, ''); }, []);

  const pagination = data.pagination;
  const firstRow = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const lastRow = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : 0;

  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Правило 843</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Коди MEGOGO</h1><p className="mt-1 text-sm text-slate-600">Завантажені коди, залишок та журнал видачі покупцям.</p></div>
      <button type="button" onClick={() => void load(pagination?.page ?? 1)} disabled={loading} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? 'Оновлення...' : 'Оновити'}</button>
    </div>
    <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-end gap-3"><label className="block text-sm font-semibold text-slate-700">Файл із кодами<input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.txt,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} disabled={uploading} className="mt-2 block w-full max-w-md text-sm font-normal" /></label><div className="pb-1 text-sm text-slate-500">Один код у кожному рядку або в першій колонці Excel.<br />Без заголовків та інших колонок.</div></div>
      {uploading ? <p className="mt-3 text-sm font-medium text-slate-700">Завантаження кодів...</p> : null}
      {uploadStatus ? <p className={`mt-3 text-sm font-medium ${uploadStatus.startsWith('Додано') ? 'text-emerald-700' : 'text-red-700'}`}>{uploadStatus}</p> : null}
    </div>
    {data.error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800">{data.error}</div> : null}
    {data.summary ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["Завантажено кодів", data.summary.total], ["Доступно до видачі", data.summary.available], ["Видано покупцям", data.summary.issued], ["Останнє показано", dateTime(data.summary.lastPresentedAt)]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200"><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-xl font-bold tabular-nums">{typeof value === 'number' ? number(value) : value}</div></div>)}
    </div> : null}
    <form onSubmit={submitSearch} className="mt-5 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block min-w-[240px] flex-1 text-sm font-semibold text-slate-700">Пошук за кодом MEGOGO<input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Введіть повний код або його частину" className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none ring-amber-500 focus:ring-2" /></label>
      <button type="submit" disabled={loading} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Знайти</button>
      {appliedSearch ? <button type="button" onClick={() => { setSearchText(''); setAppliedSearch(''); void load(1, ''); }} disabled={loading} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Очистити</button> : null}
    </form>
    {pagination ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{pagination.query ? `Знайдено: ${number(pagination.total)}` : `Усього кодів: ${number(pagination.total)}`}{pagination.total > 0 ? ` · показано ${number(firstRow)}–${number(lastRow)}` : ''}</span><div className="flex items-center gap-2"><button type="button" onClick={() => void load(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">← Назад</button><span className="whitespace-nowrap tabular-nums">Сторінка {pagination.page} з {pagination.totalPages}</span><button type="button" onClick={() => void load(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Далі →</button></div></div> : null}
    <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-[1210px] w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-3 py-3">Статус</th><th className="px-3 py-3">Код MEGOGO</th><th className="px-3 py-3">Вперше видано</th><th className="px-3 py-3">Востаннє показано</th><th className="px-3 py-3">Учасник лояльності</th><th className="px-3 py-3 text-right">Сума чека</th><th className="px-3 py-3">Магазин / каса</th><th className="px-3 py-3">Чек</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{(data.rows ?? []).map((row) => <tr key={row.id}><td className="px-3 py-3"><span className={`rounded px-2 py-1 text-xs font-semibold ${row.status === 'issued' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{row.status === 'issued' ? 'Видано' : 'Доступний'}</span></td><td className="px-3 py-3 font-mono font-semibold">{row.codeValue}</td><td className="px-3 py-3">{dateTime(row.issuedAt)}</td><td className="px-3 py-3">{dateTime(row.lastPresentedAt)}</td><td className="px-3 py-3 font-mono">{row.loyaltyCode || '—'}</td><td className="px-3 py-3 text-right tabular-nums">{row.status === 'issued' ? `${money(row.checkTotal)} грн` : '—'}</td><td className="px-3 py-3">{row.storeCode ? `ТП ${row.storeCode}` : '—'}{row.workplaceId ? ` / каса ${row.workplaceId}` : ''}</td><td className="px-3 py-3 font-mono">{row.orderCode || '—'}</td></tr>)}
      {!loading && (data.rows ?? []).length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-500">{appliedSearch ? 'За цим кодом нічого не знайдено.' : 'Кодів MEGOGO для правила 843 поки немає.'}</td></tr> : null}</tbody></table>
    </div>
  </section>;
}