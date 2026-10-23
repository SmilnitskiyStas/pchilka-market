#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildAnalysis, formatDate, formatPeriod, parsePeriodFilename } from './shock-price-summary-core.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirArgIndex = process.argv.indexOf('--dir');
const inputDir = dirArgIndex >= 0
  ? path.resolve(process.argv[dirArgIndex + 1])
  : path.join(repoRoot, 'docs', 'Analytics');
const jsonOutput = process.argv.includes('--json');

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const candidates = fs.readdirSync(inputDir)
  .filter((name) => name.toLocaleLowerCase('uk-UA').endsWith('.xlsx'))
  .map((name) => ({ path: path.join(inputDir, name), period: parsePeriodFilename(name) }))
  .filter((entry) => entry.period);
const oldFiles = candidates.filter((entry) => entry.period.kind === 'old');
const newFiles = candidates.filter((entry) => entry.period.kind === 'new');

if (oldFiles.length !== 1 || newFiles.length !== 1) {
  throw new Error(`Очікується рівно один файл «Старий з ...xlsx» і один «Новий з ...xlsx». Знайдено: старих ${oldFiles.length}, нових ${newFiles.length}.`);
}

const oldFrom = option('--old-from');
const oldTo = option('--old-to');
const newFrom = option('--new-from');
const newTo = option('--new-to');
const analysis = buildAnalysis(oldFiles[0].path, newFiles[0].path, {
  oldPeriod: oldFrom || oldTo ? { start: oldFrom, end: oldTo } : null,
  newPeriod: newFrom || newTo ? { start: newFrom, end: newTo } : null,
});
const summary = {
  oldFile: analysis.oldPeriod.fileName,
  newFile: analysis.newPeriod.fileName,
  oldPeriod: formatPeriod(analysis.oldPeriod.start, analysis.oldPeriod.end),
  newPeriod: formatPeriod(analysis.newPeriod.start, analysis.newPeriod.end),
  balanceDate: formatDate(analysis.balanceDate),
  outputFileName: analysis.outputFileName,
  products: analysis.products.length,
  stores: analysis.stores.length,
  warnings: analysis.warnings,
};

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`Старий період: ${summary.oldPeriod}`);
  console.log(`Новий період: ${summary.newPeriod}`);
  console.log(`Дата залишку: ${summary.balanceDate}`);
  console.log(`Кінцевий файл: ${summary.outputFileName}`);
  console.log(`Товарів: ${summary.products}; магазинів: ${summary.stores}`);
  if (summary.warnings.length) {
    console.log('Попередження:');
    summary.warnings.forEach((warning) => console.log(`- ${warning}`));
  } else {
    console.log('Структура двох звітів узгоджена.');
  }
}
