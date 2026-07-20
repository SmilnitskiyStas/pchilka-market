import type { ReactNode } from 'react';

import { formatUtilityMoney, type UtilityPaymentDocumentData } from '@/lib/utility-meter-payment-document';
import { getElectricitySupplierColor, getElectricitySupplierLabel } from '@/lib/utility-store-direct-contracts';

type Props = {
  document: UtilityPaymentDocumentData;
  actions?: ReactNode;
};

function supplierBadgeClass(supplier: 'yasno' | 'tolk' | undefined) {
  return getElectricitySupplierColor(supplier) === 'amber'
    ? 'bg-amber-100 text-amber-900 ring-amber-200'
    : 'bg-indigo-100 text-indigo-900 ring-indigo-200';
}

export function UtilityMeterPaymentDocument({ document, actions }: Props) {
  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-950 sm:px-6 lg:px-8 print:px-0 print:py-0">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body > header,
              body > footer,
              aside,
              nav {
                display: none !important;
              }
              main {
                padding: 0 !important;
              }
            }
          `
        }}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        {actions ? <div className="print:hidden">{actions}</div> : null}

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Pchilka Market</p>
          <h1 className="mt-1 text-3xl font-bold">Загальний рахунок: {document.audienceLabel}</h1>
          <p className="mt-2 text-sm text-slate-600">Період: {document.periodMonth.slice(0, 7)}</p>
          <p className="mt-1 text-sm text-slate-600">Магазин: {document.storeLabel}</p>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">№</th>
                  <th className="px-3 py-3">Магазин / адреса</th>
                  <th className="px-3 py-3">Орендар / лічильник</th>
                  <th className="px-3 py-3">Послуга</th>
                  <th className="px-3 py-3">Показник</th>
                  <th className="px-3 py-3">Споживання</th>
                  <th className="px-3 py-3">Тариф</th>
                  <th className="px-3 py-3 text-right">Сума, грн</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {document.rows.map((item, index) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 align-top">{index + 1}</td>
                    <td className="px-3 py-3 align-top">
                      <div className="font-semibold">{item.storeCode || item.storeLabel}</div>
                      <div className="text-xs text-slate-500">{item.addressLine}</div>
                      {item.isDirectContract ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
                            Прямий договір{item.legalEntity ? ` · ${item.legalEntity}` : ''}
                          </span>
                          {item.utilityType.startsWith('electricity') && item.electricitySupplier ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${supplierBadgeClass(item.electricitySupplier)}`}>
                              {getElectricitySupplierLabel(item.electricitySupplier)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div>{item.tenantName}</div>
                      <div className="text-xs text-slate-500">{item.meterNumber}</div>
                    </td>
                    <td className="px-3 py-3 align-top">{item.utilityLabel}</td>
                    <td className="px-3 py-3 align-top">{item.readingValue ?? '—'}</td>
                    <td className="px-3 py-3 align-top">{item.consumption ?? '—'}</td>
                    <td className="px-3 py-3 align-top">{item.rate ?? '—'}</td>
                    <td className="px-3 py-3 text-right align-top">{formatUtilityMoney(item.amount)}</td>
                  </tr>
                ))}
                {document.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                      Для цього періоду ще немає розрахованих нарахувань.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td className="px-3 py-3 text-right font-bold" colSpan={7}>
                    Разом
                  </td>
                  <td className="px-3 py-3 text-right font-bold">{formatUtilityMoney(document.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
