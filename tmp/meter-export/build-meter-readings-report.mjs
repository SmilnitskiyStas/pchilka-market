import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const root = path.resolve(import.meta.dirname, '..', '..');
const sourcePath = path.join(import.meta.dirname, 'meter-readings-2026-08-09.tsv');
const outputDir = path.join(root, 'outputs', 'utility-meter-readings-2026-08-09');
const outputPath = path.join(outputDir, 'meter-readings-2026-08-09.xlsx');

const raw = await fs.readFile(sourcePath, 'utf8');
const [headerLine, ...lines] = raw.trim().split(/\r?\n/);
const sourceHeaders = headerLine.split('\t');
const sourceRows = lines.map((line) => Object.fromEntries(sourceHeaders.map((header, index) => [header, line.split('\t')[index] ?? ''])));
const numericFields = new Set(['reading_value', 'previous_value', 'current_value', 'consumption', 'coefficient', 'rate', 'fixed_amount', 'amount', 'amount_without_vat', 'amount_with_vat']);

function value(row, field) {
  const rawValue = row[field];
  if (rawValue === '' || rawValue === 'NULL') return null;
  if (numericFields.has(field)) return Number(rawValue);
  if (field === 'includes_vat') return rawValue === '1' ? 'Так' : rawValue === '0' ? 'Ні' : rawValue;
  const labels = {
    utility_type: { water: 'Вода', electricity_active: 'Електрика', electricity_reactive: 'Реактивна електрика' },
    owner_kind: { store: 'Магазин', tenant: 'Орендар', shared: 'Спільний', other: 'Інше' },
    calculation_mode: { rate: 'Тариф', fixed_amount: 'Фіксована сума' },
    validation_status: { ok: 'OK', warning: 'Попередження', error: 'Помилка' },
    reading_status: { draft: 'Чернетка', submitted: 'Подано', approved: 'Підтверджено', rejected: 'Відхилено' },
    source_kind: { manual: 'Вручну', excel_import: 'Імпорт з Excel', system: 'Система' }
  };
  if (labels[field]?.[rawValue]) return labels[field][rawValue];
  return rawValue;
}

const columns = [
  ['Період', 'period_month'], ['Дата показання', 'reading_date'], ['Тип', 'utility_type'], ['Назва лічильника', 'utility_label'], ['ТП', 'store_code'], ['Магазин', 'store_label'], ['Адреса', 'address_line'], ['Власник', 'owner_kind'], ['Орендар', 'tenant_name'], ['№ лічильника', 'meter_number'], ['Показання', 'reading_value'], ['Попереднє', 'previous_value'], ['Поточне', 'current_value'], ['Споживання', 'consumption'], ['Коефіцієнт', 'coefficient'], ['Тариф', 'rate'], ['Режим нарахування', 'calculation_mode'], ['Фіксована сума', 'fixed_amount'], ['Сума, грн', 'amount'], ['Без ПДВ, грн', 'amount_without_vat'], ['З ПДВ, грн', 'amount_with_vat'], ['ПДВ', 'includes_vat'], ['Рахунок / посилання', 'invoice_reference'], ['Статус перевірки', 'validation_status'], ['Статус показання', 'reading_status'], ['Джерело', 'source_kind'], ['Вніс', 'submitted_by_name'], ['Створено', 'created_at'], ['Оновлено', 'updated_at']
];

const groups = [
  { name: 'Вода', tab: 'Вода', filter: (row) => row.utility_type === 'water' },
  { name: 'Електрика', tab: 'Електрика', filter: (row) => row.utility_type === 'electricity_active' },
  { name: 'Реактивна електрика', tab: 'Реактивна', filter: (row) => row.utility_type === 'electricity_reactive' },
  { name: 'Інші показники', tab: 'Інші', filter: (row) => !['water', 'electricity_active', 'electricity_reactive'].includes(row.utility_type) }
];

const workbook = Workbook.create();
const summary = workbook.worksheets.add('Підсумок');
summary.showGridLines = false;
summary.getRange('A2').values = [['Показники лічильників за серпень–вересень 2026']];
summary.getRange('A3').values = [['Джерело: облік лічильників Pchilka Market. Період: 01.08.2026–30.09.2026.']];
summary.getRange('A5:D5').values = [['Тип показника', 'Кількість показань', 'Споживання', 'Сума, грн']];

const summaryRows = groups.map((group) => {
  const rows = sourceRows.filter(group.filter);
  return [group.name, rows.length, rows.reduce((total, row) => total + (Number(value(row, 'consumption')) || 0), 0), rows.reduce((total, row) => total + (Number(value(row, 'amount')) || 0), 0)];
});
summary.getRange(`A6:D${5 + summaryRows.length}`).values = summaryRows;
summary.getRange(`A${6 + summaryRows.length}:D${6 + summaryRows.length}`).values = [['Разом', sourceRows.length, summaryRows.reduce((total, row) => total + row[2], 0), summaryRows.reduce((total, row) => total + row[3], 0)]];

for (const group of groups) {
  const rows = sourceRows.filter(group.filter);
  const sheet = workbook.worksheets.add(group.tab);
  sheet.showGridLines = false;
  sheet.getRange('A1').values = [[`Показники лічильників — ${group.name}`]];
  sheet.getRange('A2').values = [['Період: серпень–вересень 2026']];
  const consumption = rows.reduce((total, row) => total + (Number(value(row, 'consumption')) || 0), 0);
  const amount = rows.reduce((total, row) => total + (Number(value(row, 'amount')) || 0), 0);
  sheet.getRange('A3').values = [[`Кількість показань: ${rows.length}. Споживання: ${consumption.toFixed(4)}. Сума: ${amount.toFixed(2)} грн.`]];
  sheet.getRange('A5:AC5').values = [columns.map(([label]) => label)];

  if (rows.length) {
    sheet.getRange(`A6:AC${5 + rows.length}`).values = rows.map((row) => columns.map(([, field]) => value(row, field)));
    const totalRow = 6 + rows.length;
    sheet.getRange(`A${totalRow}:AC${totalRow}`).values = [['Разом', null, null, null, null, null, null, null, null, null, null, null, null, consumption, null, null, null, null, amount, null, null, null, null, null, null, null, null, null, null]];
  } else {
    sheet.getRange('A6').values = [['Даних за період немає']];
  }

  sheet.freezePanes.freezeRows(5);
  sheet.getRange(`A5:AC${Math.max(6, 6 + rows.length)}`).format.font = { name: 'Arial', size: 10 };
  sheet.getRange('A1').format = { font: { name: 'Arial', size: 14, bold: true, color: '#1F2937' }, horizontalAlignment: 'left', verticalAlignment: 'center' };
  sheet.getRange('A2:A3').format = { font: { name: 'Arial', size: 10, italic: true, color: '#4B5563' }, horizontalAlignment: 'left' };
  sheet.getRange('A5:AC5').format = { fill: '#1F4E78', font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true };
  sheet.getRange(`A6:AC${Math.max(6, 6 + rows.length)}`).format.verticalAlignment = 'center';
  sheet.getRange(`A6:AC${Math.max(6, 6 + rows.length)}`).format.borders = { preset: 'insideHorizontal', style: 'thin', color: '#E5E7EB' };
  if (rows.length) {
    const totalRow = 6 + rows.length;
    sheet.getRange(`A${totalRow}:AC${totalRow}`).format = { fill: '#EAF2F8', font: { name: 'Arial', size: 10, bold: true, color: '#1F2937' }, borders: { preset: 'doubleBottom', style: 'medium', color: '#1F4E78' } };
  }
  sheet.getRange(`A6:B${Math.max(6, 5 + rows.length)}`).format.numberFormat = 'yyyy-mm-dd';
  sheet.getRange(`K6:U${Math.max(6, 6 + rows.length)}`).format.numberFormat = '#,##0.0000';
  sheet.getRange(`R6:U${Math.max(6, 6 + rows.length)}`).format.numberFormat = '#,##0.00';
  sheet.getRange('A:AC').format.wrapText = false;
  const widths = [12, 14, 20, 28, 10, 28, 30, 12, 20, 16, 14, 14, 14, 14, 12, 12, 18, 15, 14, 16, 14, 9, 24, 16, 16, 14, 22, 19, 19];
  widths.forEach((width, index) => { sheet.getRangeByIndexes(0, index, Math.max(6, rows.length + 6), 1).format.columnWidth = width; });
}

summary.getRange('A2:D2').format = { font: { name: 'Arial', size: 14, bold: true, color: '#1F2937' }, horizontalAlignment: 'left' };
summary.getRange('A3').format = { font: { name: 'Arial', size: 10, italic: true, color: '#4B5563' } };
summary.getRange('A5:D5').format = { fill: '#1F4E78', font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center' };
summary.getRange(`A6:D${6 + summaryRows.length}`).format.font = { name: 'Arial', size: 10 };
summary.getRange(`A${6 + summaryRows.length}:D${6 + summaryRows.length}`).format = { fill: '#EAF2F8', font: { name: 'Arial', size: 10, bold: true }, borders: { preset: 'doubleBottom', style: 'medium', color: '#1F4E78' } };
summary.getRange(`C6:D${6 + summaryRows.length}`).format.numberFormat = '#,##0.00';
summary.getRange('A:D').format.autofitColumns();
summary.freezePanes.freezeRows(5);

workbook.recalculate();
await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
const inspection = await workbook.inspect({ kind: 'table', range: 'Підсумок!A2:D10', include: 'values,formulas', tableMaxRows: 12, tableMaxCols: 6 });
console.log(inspection.ndjson);
for (const group of groups) {
  const preview = await workbook.render({ sheetName: group.tab, range: 'A1:O12', scale: 1.2, format: 'png' });
  await fs.writeFile(path.join(outputDir, `${group.tab}.png`), new Uint8Array(await preview.arrayBuffer()));
}
const summaryPreview = await workbook.render({ sheetName: 'Підсумок', range: 'A1:D10', scale: 1.5, format: 'png' });
await fs.writeFile(path.join(outputDir, 'Підсумок.png'), new Uint8Array(await summaryPreview.arrayBuffer()));
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 50 }, summary: 'final formula error scan' });
console.log(errors.ndjson);
console.log(outputPath);
