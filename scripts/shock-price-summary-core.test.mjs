import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { addDays, buildAnalysis, buildSummaryData, formatDate, parsePeriodFilename } from './shock-price-summary-core.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('parses report periods from Ukrainian filenames', () => {
  const parsed = parsePeriodFilename('Новий з 01.09 по 07.09.26.xlsx');
  assert.equal(parsed.kind, 'new');
  assert.equal(formatDate(parsed.start), '01.09.26');
  assert.equal(formatDate(parsed.end), '07.09.26');
  assert.equal(formatDate(addDays(parsed.end, 1)), '08.09.26');
});

test('accepts plain filenames with dates supplied at launch', () => {
  const parsed = parsePeriodFilename('Старий.xlsx');
  assert.equal(parsed.kind, 'old');
  assert.equal(parsed.start, null);
  assert.equal(parsed.end, null);
});

test('derives the previous year for a period crossing New Year', () => {
  const parsed = parsePeriodFilename('Новий з 29.12 по 04.01.27.xlsx');
  assert.equal(formatDate(parsed.start), '29.12.26');
  assert.equal(formatDate(parsed.end), '04.01.27');
});

const datedOldFile = path.join(repoRoot, 'docs', 'Analytics', 'Старий з 25.08 по 31.08.26.xlsx');
const datedNewFile = path.join(repoRoot, 'docs', 'Analytics', 'Новий з 01.09 по 07.09.26.xlsx');

test('reads dated Analytics fixtures and detects missing products', {
  skip: !fs.existsSync(datedOldFile) || !fs.existsSync(datedNewFile),
}, () => {
  const oldFile = datedOldFile;
  const newFile = datedNewFile;
  const analysis = buildAnalysis(oldFile, newFile);
  assert.equal(analysis.outputFileName, 'Шок ціна з 01.09 по 07.09.26.xlsx');
  assert.equal(formatDate(analysis.balanceDate), '08.09.26');
  assert.equal(analysis.stores.length, 36);
  assert.equal(analysis.products.length, 13);
  assert.ok(analysis.warnings.some((warning) => warning.includes('Цукерки Конті')));

  const summary = buildSummaryData(analysis);
  assert.equal(summary.rows.length, 36);
  assert.equal(summary.totals.length, 13);
  const missingProductIndex = analysis.products.findIndex((product) => product.name.includes('Цукерки Конті'));
  assert.ok(missingProductIndex >= 0);
  assert.ok(summary.rows.every((row) => row.products[missingProductIndex].newQuantity === null));
  assert.ok(summary.rows.every((row) => row.products[missingProductIndex].balance === null));
  assert.ok(summary.rows.every((row) => row.products.every((product) => (
    product.coefficient == null || Number.isInteger(product.coefficient)
  ))));
  assert.ok(summary.totals.every((product) => Number.isInteger(product.coefficient)));
});
