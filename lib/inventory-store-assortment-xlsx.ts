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

function pickValue(row: Record<string, unknown>, headers: string[]) {
  for (const [key, value] of Object.entries(row)) {
    if (headers.includes(normalizeHeader(key))) {
      return value;
    }
  }
  return '';
}

function parseQuantity(value: unknown) {
  const raw = normalizeCell(value).replace(/\s+/g, '').replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseInventoryStoreAssortmentWorkbook(buffer: Buffer): InventoryStoreAssortmentImportRow[] {
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

  return rows
    .map((row) => ({
      article: normalizeCell(pickValue(row, ['артикул', 'кодтовару', 'код', 'article'])),
      barcode: normalizeCell(pickValue(row, ['штрихкод', 'barcode', 'баркод'])),
      productName: normalizeCell(
        pickValue(row, ['номенклатура', 'назва', 'найменування', 'товар', 'productname', 'name'])
      ),
      unitsOfMeasurement: normalizeCell(
        pickValue(row, ['одиницявимірювання', 'одиницявимiрювання', 'одвим', 'одиниця', 'units', 'uom'])
      ),
      quantity: parseQuantity(pickValue(row, ['кількість', 'кiлькiсть', 'qty', 'quantity', 'залишок', 'остаток']))
    }))
    .filter((row) => row.article || row.barcode || row.productName);
}
