import * as XLSX from 'xlsx';

import type { InventoryProductImportRow } from '@/lib/inventory-products-repository';

function normalizeCell(value: unknown): string {
  return String(value ?? '').trim();
}

export function parseInventoryProductsWorkbook(buffer: Buffer): InventoryProductImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('У файлі Excel немає жодного аркуша.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false
  });

  return rows.map((row) => ({
    productName: normalizeCell(row['Номенклатура']),
    unitsOfMeasurement: normalizeCell(row['Одиниці вимірювання']),
    barcode: normalizeCell(row['Штрихкод']),
    article: normalizeCell(row['Артикул']),
    category: '',
    notifiedDaysDefault: 7,
    isActive: true
  }));
}
