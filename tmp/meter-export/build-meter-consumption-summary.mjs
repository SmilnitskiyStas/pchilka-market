import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const root = path.resolve(import.meta.dirname, '..', '..');
const sourcePath = path.join(import.meta.dirname, 'meter-readings-2026-08-09.tsv');
const outputDir = path.join(root, 'outputs', 'utility-meter-consumption-2026-08-09');
const outputPath = path.join(outputDir, 'meter-consumption-2026-08-09.xlsx');

const [header, ...lines] = (await fs.readFile(sourcePath, 'utf8')).trim().split(/\r?\n/);
const fields = header.split('\t');
const rows = lines.map((line) => Object.fromEntries(fields.map((field, index) => [field, line.split('\t')[index] ?? ''])));
const utilityTypes = [
  ['water', 'Вода'],
  ['electricity_active', 'Електрика'],
  ['electricity_reactive', 'Реактивна електрика'],
  ['other', 'Інші показники']
];
const months = [
  ['2026-08-01', 'Серпень'],
  ['2026-09-01', 'Вересень']
];

const workbook = Workbook.create();
for (const [periodMonth, sheetName] of months) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.showGridLines = false;
  const totals = utilityTypes.map(([type, label]) => {
    const consumption = rows
      .filter((row) => row.period_month === periodMonth && (type === 'other' ? !['water', 'electricity_active', 'electricity_reactive'].includes(row.utility_type) : row.utility_type === type))
      .reduce((total, row) => total + (Number(row.consumption === 'NULL' ? 0 : row.consumption) || 0), 0);
    return [label, consumption];
  });
  const totalConsumption = totals.reduce((total, row) => total + row[1], 0);

  sheet.getRange('A2').values = [[`Споживання за ${sheetName.toLowerCase()} 2026 року`]];
  sheet.getRange('A3').values = [['Джерело: облік лічильників Pchilka Market.']];
  sheet.getRange('A5:B5').values = [['Тип лічильника', 'Загальне споживання']];
  sheet.getRange('A6:B9').values = totals;
  sheet.getRange('A10:B10').values = [['Разом', totalConsumption]];

  sheet.getRange('A2').format = { font: { name: 'Arial', size: 14, bold: true, color: '#1F2937' } };
  sheet.getRange('A3').format = { font: { name: 'Arial', size: 10, italic: true, color: '#4B5563' } };
  sheet.getRange('A5:B5').format = { fill: '#1F4E78', font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center' };
  sheet.getRange('A6:B9').format = { font: { name: 'Arial', size: 10 }, verticalAlignment: 'center', borders: { preset: 'insideHorizontal', style: 'thin', color: '#E5E7EB' } };
  sheet.getRange('A10:B10').format = { fill: '#EAF2F8', font: { name: 'Arial', size: 10, bold: true }, borders: { preset: 'doubleBottom', style: 'medium', color: '#1F4E78' } };
  sheet.getRange('B6:B10').format.numberFormat = '#,##0.0000';
  sheet.getRange('A1:A10').format.columnWidth = 28;
  sheet.getRange('B1:B10').format.columnWidth = 24;
  sheet.freezePanes.freezeRows(5);
}

workbook.recalculate();
const check = await workbook.inspect({ kind: 'table', range: 'Серпень!A2:B10', include: 'values,formulas', tableMaxRows: 12, tableMaxCols: 4 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 50 }, summary: 'final formula error scan' });
console.log(errors.ndjson);
for (const [, sheetName] of months) {
  const preview = await workbook.render({ sheetName, range: 'A1:B10', scale: 1.5, format: 'png' });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, `${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
}
await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
