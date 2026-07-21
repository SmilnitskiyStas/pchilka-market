import * as XLSX from 'xlsx';

import type { InventoryStoreAssortmentImportRow } from '@/lib/inventory-store-assortment-types';

function normalizeCell(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeHeader(value: unknown): string {
  return normalizeCell(value)
    .toLowerCase()
    .replace(/['’`"]/g, '')
    .replace(/\s+/g, '')
    .replace(/[._/\\()-]/g, '');
}

function parseQuantity(value: unknown) {
  const raw = normalizeCell(value).replace(/\s+/g, '').replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const assortmentColumnAliases = {
  article: ['артикул', 'кодтовару', 'код', 'article', 'sku'],
  barcode: ['штрихкод', 'barcode', 'баркод', 'ean'],
  productName: ['номенклатура', 'назва', 'найменування', 'товар', 'productname', 'name', 'product'],
  unitsOfMeasurement: ['одиницявимірювання', 'одиницявимiрювання', 'одвим', 'одиниця', 'units', 'uom'],
  quantity: ['кількість', 'кiлькiсть', 'qty', 'quantity', 'залишок', 'остаток']
} as const;

type AssortmentColumn = keyof typeof assortmentColumnAliases;

function findAssortmentHeaderRow(rows: unknown[][]) {
  let bestMatch: { rowIndex: number; columns: Partial<Record<AssortmentColumn, number>> } | null = null;

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex += 1) {
    const columns: Partial<Record<AssortmentColumn, number>> = {};
    for (const [columnIndex, value] of rows[rowIndex].entries()) {
      const header = normalizeHeader(value);
      for (const [field, aliases] of Object.entries(assortmentColumnAliases) as [AssortmentColumn, readonly string[]][]) {
        if (aliases.includes(header)) {
          columns[field] = columnIndex;
        }
      }
    }

    const score = Object.keys(columns).length;
    if (score > 0 && (!bestMatch || score > Object.keys(bestMatch.columns).length)) {
      bestMatch = { rowIndex, columns };
    }
  }

  return bestMatch;
}

function getCellFromColumn(row: unknown[], columns: Partial<Record<AssortmentColumn, number>>, field: AssortmentColumn) {
  const columnIndex = columns[field];
  return typeof columnIndex === 'number' ? row[columnIndex] : '';
}

export function parseInventoryStoreAssortmentWorkbook(buffer: Buffer): InventoryStoreAssortmentImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('У файлі Excel немає жодного аркуша.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false
  });

  const header = findAssortmentHeaderRow(rows);
  if (!header) {
    return [];
  }

  return rows
    .slice(header.rowIndex + 1)
    .map((row) => ({
      article: normalizeCell(getCellFromColumn(row, header.columns, 'article')),
      barcode: normalizeCell(getCellFromColumn(row, header.columns, 'barcode')),
      productName: normalizeCell(getCellFromColumn(row, header.columns, 'productName')),
      unitsOfMeasurement: normalizeCell(getCellFromColumn(row, header.columns, 'unitsOfMeasurement')),
      quantity: parseQuantity(getCellFromColumn(row, header.columns, 'quantity'))
    }))
    .filter((row) => row.article || row.barcode || row.productName);
}
