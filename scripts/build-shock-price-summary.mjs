#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import XLSX from 'xlsx-js-style';

import {
  buildAnalysis,
  buildSummaryData,
  formatDate,
  formatPeriod,
  parsePeriodFilename,
} from './shock-price-summary-core.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function findInputs(inputDir) {
  const candidates = fs.readdirSync(inputDir)
    .filter((name) => name.toLocaleLowerCase('uk-UA').endsWith('.xlsx'))
    .map((name) => ({ path: path.join(inputDir, name), period: parsePeriodFilename(name) }))
    .filter((entry) => entry.period);
  const oldFiles = candidates.filter((entry) => entry.period.kind === 'old');
  const newFiles = candidates.filter((entry) => entry.period.kind === 'new');
  if (oldFiles.length !== 1 || newFiles.length !== 1) {
    throw new Error(`Очікується рівно один файл «Старий...xlsx» і один «Новий...xlsx». Знайдено: старих ${oldFiles.length}, нових ${newFiles.length}.`);
  }
  return { oldFile: oldFiles[0].path, newFile: newFiles[0].path };
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function applyStyle(sheet, row, column, style, numberFormat = null) {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  if (!sheet[address]) sheet[address] = { t: 's', v: '' };
  sheet[address].s = clone(style);
  if (numberFormat) sheet[address].z = numberFormat;
}

function buildWorkbook(analysis) {
  const summary = buildSummaryData(analysis);
  const rows = [[], [], []];
  rows[0][0] = 'Торговий центр';

  analysis.products.forEach((product, index) => {
    const column = 1 + index * 4;
    rows[0][column] = product.code;
    rows[1][column] = product.name;
    rows[2][column] = `К-ть продаж з ${formatPeriod(analysis.oldPeriod.start, analysis.oldPeriod.end).replace('–', ' по ')}`;
    rows[2][column + 1] = `К-ть продаж з ${formatPeriod(analysis.newPeriod.start, analysis.newPeriod.end).replace('–', ' по ')}`;
    rows[2][column + 2] = 'Коєф.приросту';
    rows[2][column + 3] = `Залишок на ${formatDate(analysis.balanceDate)}`;
  });

  summary.rows.forEach((store) => {
    const row = [store.name];
    store.products.forEach((product) => {
      row.push(product.oldQuantity, product.newQuantity, product.coefficient, product.balance);
    });
    rows.push(row);
  });
  const totalRow = ['Разом'];
  summary.totals.forEach((product) => {
    totalRow.push(product.oldQuantity, product.newQuantity, product.coefficient, product.balance);
  });
  rows.push(totalRow);

  const templatePath = path.join(repoRoot, 'scripts', 'templates', 'shock-price-template.xlsx');
  const templateWorkbook = XLSX.readFile(templatePath, { cellStyles: true });
  const templateSheet = templateWorkbook.Sheets[templateWorkbook.SheetNames[0]];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const lastColumn = analysis.products.length * 4;
  const totalRowIndex = rows.length - 1;

  const border = {
    top: { style: 'thin', color: { rgb: '808080' } },
    bottom: { style: 'thin', color: { rgb: '808080' } },
    left: { style: 'thin', color: { rgb: '808080' } },
    right: { style: 'thin', color: { rgb: '808080' } },
  };
  const styles = {
    nameHeader: {
      fill: { patternType: 'solid', fgColor: { rgb: '4574A0' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border,
    },
    productCode: {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } },
      font: { bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border,
    },
    productName: {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } },
      font: { bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border,
    },
    fieldHeader: {
      fill: { patternType: 'solid', fgColor: { rgb: '4574A0' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border,
    },
    storeName: {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
      font: { color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border,
    },
    value: {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
      font: { color: { rgb: '000000' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border,
    },
    totalName: {
      fill: { patternType: 'solid', fgColor: { rgb: '0070C0' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border,
    },
    totalValue: {
      fill: { patternType: 'solid', fgColor: { rgb: '0070C0' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border,
    },
  };

  for (let column = 0; column <= lastColumn; column += 1) {
    applyStyle(sheet, 0, column, column === 0 ? styles.nameHeader : styles.productCode);
    applyStyle(sheet, 1, column, column === 0 ? styles.nameHeader : styles.productName);
    applyStyle(sheet, 2, column, column === 0 ? styles.nameHeader : styles.fieldHeader);
  }
  for (let row = 3; row < totalRowIndex; row += 1) {
    applyStyle(sheet, row, 0, styles.storeName);
    for (let column = 1; column <= lastColumn; column += 1) {
      applyStyle(sheet, row, column, styles.value, (column - 1) % 4 === 2 ? '0' : 'General');
    }
  }
  applyStyle(sheet, totalRowIndex, 0, styles.totalName);
  for (let column = 1; column <= lastColumn; column += 1) {
    applyStyle(sheet, totalRowIndex, column, styles.totalValue, (column - 1) % 4 === 2 ? '0' : 'General');
  }

  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 2, c: 0 } }];
  analysis.products.forEach((_, index) => {
    const start = 1 + index * 4;
    sheet['!merges'].push(
      { s: { r: 0, c: start }, e: { r: 0, c: start + 3 } },
      { s: { r: 1, c: start }, e: { r: 1, c: start + 3 } },
    );
  });
  const sourceWidths = templateSheet['!cols'] ?? [];
  sheet['!cols'] = [{ wch: sourceWidths[0]?.wch ?? 54 }];
  for (let column = 1; column <= lastColumn; column += 1) {
    const templateColumn = 1 + ((column - 1) % 4);
    sheet['!cols'].push({ wch: sourceWidths[templateColumn]?.wch ?? [13, 13, 10, 12][templateColumn - 1] });
  }
  const sourceRows = templateSheet['!rows'] ?? [];
  sheet['!rows'] = rows.map((_, index) => ({
    hpt: index < 3
      ? (sourceRows[index]?.hpt ?? [14, 26, 38][index])
      : (sourceRows[Math.min(index, 39)]?.hpt ?? 15),
  }));
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: totalRowIndex - 1, c: lastColumn } }) };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'TDSheet');
  workbook.Workbook = { CalcPr: { fullCalcOnLoad: '1', forceFullCalc: '1', calcMode: 'auto' } };
  return workbook;
}

function main() {
  const inputDir = path.resolve(option('--dir') ?? path.join(repoRoot, 'docs', 'Analytics'));
  const outputDir = path.resolve(option('--output-dir') ?? inputDir);
  const { oldFile, newFile } = findInputs(inputDir);
  const oldFrom = option('--old-from');
  const oldTo = option('--old-to');
  const newFrom = option('--new-from');
  const newTo = option('--new-to');
  const analysis = buildAnalysis(oldFile, newFile, {
    oldPeriod: oldFrom || oldTo ? { start: oldFrom, end: oldTo } : null,
    newPeriod: newFrom || newTo ? { start: newFrom, end: newTo } : null,
  });

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, analysis.outputFileName);
  if (fs.existsSync(outputPath) && !process.argv.includes('--overwrite')) {
    throw new Error(`Файл уже існує: ${outputPath}. Для заміни додайте --overwrite.`);
  }
  XLSX.writeFile(buildWorkbook(analysis), outputPath, { cellStyles: true, compression: true });

  console.log(`Готово: ${outputPath}`);
  console.log(`Товарів: ${analysis.products.length}; магазинів: ${analysis.stores.length}; дата залишку: ${formatDate(analysis.balanceDate)}`);
  analysis.warnings.forEach((warning) => console.warn(`Попередження: ${warning}`));
}

try {
  main();
} catch (error) {
  console.error(`\nПомилка: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
