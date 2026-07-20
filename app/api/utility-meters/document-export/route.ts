import path from 'path';

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { isAdminRequestAuthorized } from '@/lib/admin-auth';
import { parseUtilityMeterDocumentShareToken } from '@/lib/utility-meter-document-share-token';
import {
  formatUtilityMoney,
  getUtilityPaymentDocumentData,
  getUtilityPaymentDocumentFileBaseName,
  normalizeUtilityPaymentDocumentAudience,
  normalizeUtilityPeriodMonth
} from '@/lib/utility-meter-payment-document';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { getElectricitySupplierLabel } from '@/lib/utility-store-direct-contracts';

export const runtime = 'nodejs';

function excelBuffer(documentData: Awaited<ReturnType<typeof getUtilityPaymentDocumentData>>) {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Документ на оплату комунальних нарахувань'],
    [`Період: ${documentData.periodMonth.slice(0, 7)}`],
    [`Магазин: ${documentData.storeLabel}`],
    []
  ]);

  XLSX.utils.sheet_add_json(
    worksheet,
    documentData.rows.map((item, index) => ({
      '№': index + 1,
      'Магазин': item.storeCode || item.storeLabel,
      'Адреса': item.addressLine,
      'ТОВ': item.legalEntity,
      'Прямий договір': item.isDirectContract ? 'Так' : '',
      'Постачальник електрики': item.utilityType.startsWith('electricity') ? getElectricitySupplierLabel(item.electricitySupplier) : '',
      'Орендар': item.tenantName,
      'Лічильник': item.meterNumber,
      'Послуга': item.utilityLabel,
      'Показник': item.readingValue ?? '',
      'Споживання': item.consumption ?? '',
      'Тариф': item.rate ?? '',
      'Сума, грн': item.amount ?? ''
    })),
    { origin: 'A5' }
  );

  XLSX.utils.sheet_add_aoa(worksheet, [['Разом', '', '', '', '', '', '', '', '', '', '', '', documentData.total]], {
    origin: `A${documentData.rows.length + 7}`
  });

  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Нарахування');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

async function pdfBuffer(documentData: Awaited<ReturnType<typeof getUtilityPaymentDocumentData>>) {
  const pdfmake = require('pdfmake');

  pdfmake.setFonts({
    Roboto: {
      normal: path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto', 'Roboto-Regular.ttf'),
      bold: path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto', 'Roboto-Medium.ttf'),
      italics: path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto', 'Roboto-Italic.ttf'),
      bolditalics: path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto', 'Roboto-MediumItalic.ttf')
    }
  });
  pdfmake.setLocalAccessPolicy(() => true);

  const body = [
    [
      { text: '№', style: 'tableHeader' },
      { text: 'Магазин / адреса', style: 'tableHeader' },
      { text: 'Орендар / лічильник', style: 'tableHeader' },
      { text: 'Послуга', style: 'tableHeader' },
      { text: 'Показник', style: 'tableHeader' },
      { text: 'Споживання', style: 'tableHeader' },
      { text: 'Тариф', style: 'tableHeader' },
      { text: 'Сума, грн', style: 'tableHeader', alignment: 'right' }
    ],
    ...documentData.rows.map((item, index) => ([
      String(index + 1),
      {
        stack: [
          { text: item.storeCode || item.storeLabel, bold: true },
          { text: item.addressLine, fontSize: 8, color: '#475569' },
          ...(item.isDirectContract
            ? [
                { text: `Прямий договір${item.legalEntity ? ` · ${item.legalEntity}` : ''}`, fontSize: 8, color: '#047857' },
                ...(item.utilityType.startsWith('electricity') && item.electricitySupplier
                  ? [{ text: getElectricitySupplierLabel(item.electricitySupplier), fontSize: 8, color: item.electricitySupplier === 'yasno' ? '#b45309' : '#4338ca' }]
                  : [])
              ]
            : [])
        ]
      },
      { stack: [{ text: item.tenantName }, { text: item.meterNumber, fontSize: 8, color: '#475569' }] },
      item.utilityLabel,
      item.readingValue ?? '—',
      item.consumption ?? '—',
      item.rate ?? '—',
      { text: formatUtilityMoney(item.amount), alignment: 'right' }
    ])),
    [
      { text: 'Разом', colSpan: 7, alignment: 'right', bold: true },
      {},
      {},
      {},
      {},
      {},
      {},
      { text: formatUtilityMoney(documentData.total), alignment: 'right', bold: true }
    ]
  ];

  const documentDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape' as const,
    pageMargins: [24, 24, 24, 24] as [number, number, number, number],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9
    },
    content: [
      { text: 'Pchilka Market', color: '#b45309', bold: true, margin: [0, 0, 0, 4] },
      { text: 'Документ на оплату комунальних нарахувань', fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
      { text: `Період: ${documentData.periodMonth.slice(0, 7)}`, margin: [0, 0, 0, 2] },
      { text: `Магазин: ${documentData.storeLabel}`, margin: [0, 0, 0, 12] },
      {
        table: {
          headerRows: 1,
          widths: [20, '*', '*', 90, 55, 70, 55, 70],
          body
        },
        layout: 'lightHorizontalLines'
      }
    ],
    styles: {
      tableHeader: {
        bold: true,
        fillColor: '#e2e8f0'
      }
    }
  };

  const pdf = pdfmake.createPdf(documentDefinition);
  return pdf.getBuffer();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = String(url.searchParams.get('format') ?? '').trim().toLowerCase();
    const shareToken = String(url.searchParams.get('shareToken') ?? '').trim();

    let periodMonth = normalizeUtilityPeriodMonth(url.searchParams.get('periodMonth') ?? undefined);
    let storeId = String(url.searchParams.get('storeId') ?? '').trim();
    let audience = normalizeUtilityPaymentDocumentAudience(url.searchParams.get('audience'));

    if (shareToken) {
      const settings = await getInventoryTelegramSettingsFromDb();
      if (!settings.webhookSecret) {
        return NextResponse.json({ ok: false, error: 'Не налаштовано секрет для зовнішнього доступу.' }, { status: 500 });
      }

      const payload = parseUtilityMeterDocumentShareToken(shareToken, settings.webhookSecret);
      if (!payload) {
        return NextResponse.json({ ok: false, error: 'Недійсне або прострочене посилання.' }, { status: 401 });
      }

      periodMonth = payload.periodMonth;
      storeId = payload.storeId;
      audience = payload.audience;
    } else if (!isAdminRequestAuthorized(request)) {
      return NextResponse.json({ ok: false, error: 'Потрібна авторизація.' }, { status: 401 });
    }

    const documentData = await getUtilityPaymentDocumentData({ periodMonth, storeId, audience });
    const fileBaseName = getUtilityPaymentDocumentFileBaseName({
      periodMonth,
      audience,
      storeCode: documentData.storeCode,
      storeId: documentData.storeId
    });

    if (format === 'xlsx' || format === 'excel') {
      const buffer = excelBuffer(documentData);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=\"${fileBaseName}.xlsx\"`
        }
      });
    }

    if (format === 'pdf') {
      const buffer = await pdfBuffer(documentData);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=\"${fileBaseName}.pdf\"`
        }
      });
    }

    return NextResponse.json({ ok: false, error: 'Непідтримуваний формат експорту.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
