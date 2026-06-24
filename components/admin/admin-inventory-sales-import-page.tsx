'use client';

import { useMemo, useState } from 'react';

type SaleImportRowResult = {
  rowNumber: number;
  externalSaleId: string;
  status: 'imported' | 'skipped' | 'failed';
  article: string;
  productName: string;
  quantity: number;
  soldAt: string;
  message: string;
  allocations: Array<{
    batchId: number;
    soldQuantity: number;
    expiryDate: string;
  }>;
};

type SaleImportResult = {
  fileName: string;
  saleSource: string;
  dryRun: boolean;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  importedQuantity: number;
  rows: SaleImportRowResult[];
};

type SalesImportPayload = {
  ok?: boolean;
  importResult?: SaleImportResult;
  error?: string;
};

function formatQuantity(value: number) {
  return new Intl.NumberFormat('uk-UA', {
    maximumFractionDigits: 3
  }).format(value);
}

function formatAllocation(row: SaleImportRowResult) {
  if (!row.allocations.length) return '-';
  return row.allocations
    .map((item) => `#${item.batchId}: ${formatQuantity(item.soldQuantity)} до ${item.expiryDate}`)
    .join('; ');
}

export default function AdminInventorySalesImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SaleImportResult | null>(null);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const problemRows = useMemo(() => result?.rows.filter((row) => row.status !== 'imported') ?? [], [result]);
  const previewRows = useMemo(() => result?.rows.filter((row) => row.status === 'imported').slice(0, 30) ?? [], [result]);

  async function uploadSalesFile(dryRun: boolean) {
    if (!file) {
      setError('Оберіть Excel-файл продажів.');
      return;
    }

    setError('');
    if (dryRun) {
      setIsChecking(true);
    } else {
      setIsImporting(true);
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', dryRun ? '1' : '0');

      const response = await fetch('/api/admin/inventory/sales/import', {
        method: 'POST',
        body: formData
      });
      const payload = (await response.json()) as SalesImportPayload;

      if (!response.ok || !payload.ok || !payload.importResult) {
        throw new Error(payload.error || 'Не вдалося обробити файл продажів.');
      }

      setResult(payload.importResult);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Не вдалося обробити файл продажів.');
    } finally {
      setIsChecking(false);
      setIsImporting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Продажі</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">FEFO-імпорт продажів</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Завантажте касовий Excel-звіт, перевірте відповідність товарам, магазинам і партіям, потім підтвердьте
              фактичне списання.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="block">
              <span className="sr-only">Файл продажів</span>
              <input
                type="file"
                accept=".xlsx"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setResult(null);
                  setError('');
                }}
                className="block w-full max-w-sm rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:border-slate-400"
              />
            </label>
            <button
              type="button"
              onClick={() => void uploadSalesFile(true)}
              disabled={!file || isChecking || isImporting}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isChecking ? 'Перевіряю...' : 'Перевірити'}
            </button>
          </div>
        </div>

        {file ? (
          <p className="mt-4 text-sm text-slate-500">
            Файл: <span className="font-semibold text-slate-800">{file.name}</span>
          </p>
        ) : null}

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      </div>

      {result ? (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <SummaryTile label="Рядків" value={String(result.totalRows)} />
            <SummaryTile label={result.dryRun ? 'Готові' : 'Списано'} value={String(result.importedRows)} tone="green" />
            <SummaryTile label="Пропущено" value={String(result.skippedRows)} tone="amber" />
            <SummaryTile label="Помилки" value={String(result.failedRows)} tone="red" />
            <SummaryTile label="Кількість" value={formatQuantity(result.importedQuantity)} />
          </div>

          {result.dryRun ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Dry-run завершено. Фактичне списання ще не виконувалось.</p>
                <p className="mt-1 text-sm text-emerald-800">Перевірте помилки нижче. Підтвердження спише тільки рядки, які проходять перевірку.</p>
              </div>
              <button
                type="button"
                onClick={() => void uploadSalesFile(false)}
                disabled={!file || isChecking || isImporting}
                className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isImporting ? 'Списую...' : 'Підтвердити списання'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
              Імпорт завершено. Повторне завантаження цього самого файлу пропустить уже списані рядки.
            </div>
          )}

          <ResultTable title="Проблемні рядки" rows={problemRows} emptyText="Проблемних рядків немає." />
          <ResultTable title="Перші рядки до списання" rows={previewRows} emptyText="Немає рядків для списання." />
        </>
      ) : null}
    </section>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'slate'
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'green' | 'amber' | 'red';
}) {
  const toneClass =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'red'
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-slate-200 bg-white text-slate-950';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ResultTable({ title, rows, emptyText }: { title: string; rows: SaleImportRowResult[]; emptyText: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Рядок</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Артикул</th>
                <th className="px-4 py-3">Товар</th>
                <th className="px-4 py-3">К-сть</th>
                <th className="px-4 py-3">Час</th>
                <th className="px-4 py-3">Повідомлення</th>
                <th className="px-4 py-3">FEFO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.externalSaleId}:${row.rowNumber}`} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{row.rowNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.article}</td>
                  <td className="min-w-64 px-4 py-3 text-slate-900">{row.productName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatQuantity(row.quantity)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.soldAt}</td>
                  <td className="min-w-72 px-4 py-3 text-slate-700">{row.message}</td>
                  <td className="min-w-72 px-4 py-3 text-slate-700">{formatAllocation(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SaleImportRowResult['status'] }) {
  const label = status === 'imported' ? 'Готово' : status === 'skipped' ? 'Пропуск' : 'Помилка';
  const className =
    status === 'imported'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'skipped'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-red-200 bg-red-50 text-red-700';

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}
