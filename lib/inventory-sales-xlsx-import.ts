import * as XLSX from 'xlsx';

function normalizeCell(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeNumber(value: unknown): number {
  const raw = normalizeCell(value).replace(/\s/g, '');
  const normalized = raw.includes(',') && raw.includes('.') ? raw.replace(/,/g, '') : raw.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSaleDateTime(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }

  const raw = normalizeCell(value);
  const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return raw;

  const [, day, month, year, hour, minute, second] = match;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export type InventorySaleImportRow = {
  rowNumber: number;
  reportDate: string;
  storeLabel: string;
  cashRegister: string;
  receiptNumber: string;
  article: string;
  productName: string;
  priceScheme: string;
  price: number;
  discountedPrice: number;
  soldAt: string;
  quantity: number;
  lineTotal: number;
  receiptTotal: number;
};

export function parseInventorySalesWorkbook(buffer: Buffer): InventorySaleImportRow[] {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('У файлі Excel немає жодного аркуша.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false
  });

  return rows
    .map((row, index) => ({
      rowNumber: index + 2,
      reportDate: normalizeCell(row['Дата отчета']),
      storeLabel: normalizeCell(row['Торговый зал']),
      cashRegister: normalizeCell(row['Касса']),
      receiptNumber: normalizeCell(row['Чек']),
      article: normalizeCell(row['Артикул']),
      productName: normalizeCell(row['Номенклатура']),
      priceScheme: normalizeCell(row['Схема цены']),
      price: normalizeNumber(row['Цена']),
      discountedPrice: normalizeNumber(row['Цена со скидкой']),
      soldAt: parseSaleDateTime(row['Время продажи']),
      quantity: normalizeNumber(row['Количество']),
      lineTotal: normalizeNumber(row['Сумма']),
      receiptTotal: normalizeNumber(row['Сумма чека'])
    }))
    .filter((row) => row.storeLabel && row.article && row.productName && row.soldAt && row.quantity > 0);
}
