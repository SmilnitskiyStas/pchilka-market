#!/usr/bin/env node

import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import mysql from 'mysql2/promise';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const defaultDocsDir = path.join(repoRoot, 'docs', 'лічільники');
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const docsDir = process.argv.includes('--dir')
  ? path.resolve(process.argv[process.argv.indexOf('--dir') + 1])
  : defaultDocsDir;

function text(value) {
  return value == null ? '' : String(value).trim();
}

function num(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedCalendarDate(yearValue, monthValue, dayValue) {
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1) return null;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const normalizedDay = Math.min(day, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(normalizedDay).padStart(2, '0')}`;
}

function excelDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return normalizedCalendarDate(parsed.y, parsed.m, parsed.d);
  }
  const raw = text(value);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return normalizedCalendarDate(iso[1], iso[2], iso[3]);
  const local = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (local) return normalizedCalendarDate(local[3], local[2], local[1]);
  return null;
}

function periodMonth(value) {
  const date = excelDate(value);
  return date ? `${date.slice(0, 7)}-01` : null;
}

function utilityType(label) {
  const value = text(label).toLowerCase();
  if (value.includes('реактив')) return 'electricity_reactive';
  if (value.includes('елект') || value.includes('элект') || value.includes('актив') || value.includes('квт')) return 'electricity_active';
  if (value.includes('вод') || value.includes('хв')) return 'water';
  if (value.includes('тбо') || value.includes('сміт') || value.includes('мусор')) return 'waste';
  if (value.includes('експл') || value.includes('экспл')) return 'maintenance';
  if (value.includes('оренд') || value.includes('аренд')) return 'rent';
  return 'other';
}

function sourceKey(parts) {
  const raw = parts.map((part) => text(part).toLowerCase()).join('|');
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function sheetRows(workbook, sheetName) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null });
}

function parseSubleaseWorkbook(fileName, workbook) {
  if (!workbook.SheetNames.includes('субаренда')) return [];
  const rows = sheetRows(workbook, 'субаренда');
  const header = rows[0] ?? [];
  const dateColumns = header
    .map((value, index) => ({ index, date: excelDate(value), month: periodMonth(value) }))
    .filter((item) => item.date && item.index >= 11);
  const records = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const storeCode = text(row[1]);
    const address = text(row[2]);
    const tenant = text(row[3]);
    const utilityLabel = text(row[4]);
    if (!storeCode || !address || !utilityLabel) continue;

    const point = {
      storeCode,
      storeLabel: storeCode,
      addressLine: address,
      ownerKind: tenant ? 'tenant' : 'store',
      tenantName: tenant,
      legalEntity: tenant,
      providerName: '',
      contractNumber: text(row[9]),
      utilityType: utilityType(utilityLabel),
      utilityLabel,
      meterNumber: text(row[10]),
      coefficient: 1,
      areaSqM: num(row[6]),
      sourceKey: sourceKey([fileName, 'субаренда', storeCode, address, tenant, utilityLabel, row[10]]),
      sourceFile: fileName,
      sourceSheet: 'субаренда'
    };

    for (const column of dateColumns) {
      const readingValue = num(row[column.index]);
      if (readingValue == null) continue;
      records.push({
        point,
        reading: {
          periodMonth: column.month,
          readingDate: column.date,
          readingValue,
          sourceCell: XLSX.utils.encode_cell({ r: rowIndex, c: column.index })
        }
      });
    }
  }

  return records;
}

function parseExpenseSheets(fileName, workbook) {
  const records = [];
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === 'субаренда' || sheetName === 'Договора' || sheetName.startsWith('ОПЛАТИ')) continue;
    const rows = sheetRows(workbook, sheetName);
    let currentTitle = '';
    let currentAddress = '';

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];
      const firstCells = row.slice(0, 6).map(text).join(' ');
      if (firstCells.includes('Расход') || firstCells.includes('Витрат')) currentTitle = firstCells;
      if (firstCells.includes('Местоположение')) {
        currentAddress = row.map(text).find((item) => item.includes('магазин') || item.includes('Пчелка')) ?? currentAddress;
      }

      const meterNumber = text(row[4] ?? row[3]);
      const utilityLabel = text(row[5] ?? row[4]);
      const previousDate = excelDate(row[6]);
      const previousValue = num(row[7]);
      const currentDate = excelDate(row[8]);
      const currentValue = num(row[9]);
      const coefficient = num(row[10]) ?? 1;
      const rate = num(row[12]);
      const expectedAmount = num(row[13]);

      if (!meterNumber || !utilityLabel || !currentDate || currentValue == null) continue;
      if (utilityLabel.toLowerCase().includes('энергоноситель')) continue;

      const storeCodeMatch = `${sheetName} ${currentAddress}`.match(/М\s?(\d+[/-]?\d*)/i);
      const storeCode = storeCodeMatch ? `М${storeCodeMatch[1]}` : sheetName;
      const tenantName = text(row[2]) || text(row[1]);
      const legalEntity = text(row[3]);
      const point = {
        storeCode,
        storeLabel: currentAddress || storeCode,
        addressLine: currentAddress,
        ownerKind: tenantName || legalEntity ? 'tenant' : 'store',
        tenantName,
        legalEntity,
        providerName: '',
        contractNumber: '',
        utilityType: utilityType(utilityLabel),
        utilityLabel,
        meterNumber,
        coefficient,
        areaSqM: null,
        sourceKey: sourceKey([fileName, sheetName, storeCode, tenantName, legalEntity, utilityLabel, meterNumber]),
        sourceFile: fileName,
        sourceSheet: sheetName
      };

      if (previousDate && previousValue != null) {
        records.push({
          point,
          reading: {
            periodMonth: periodMonth(previousDate),
            readingDate: previousDate,
            readingValue: previousValue,
            sourceCell: XLSX.utils.encode_cell({ r: rowIndex, c: 7 })
          }
        });
      }

      records.push({
        point,
        reading: {
          periodMonth: periodMonth(currentDate),
          readingDate: currentDate,
          readingValue: currentValue,
          sourceCell: XLSX.utils.encode_cell({ r: rowIndex, c: 9 })
        },
        rate: rate == null ? null : { periodMonth: periodMonth(currentDate), rate },
        expectedAmount,
        title: currentTitle
      });
    }
  }
  return records;
}

function parseMeterBook(fileName, workbook) {
  const records = [];
  for (const sheetName of workbook.SheetNames) {
    if (!sheetName.toLowerCase().includes('счетчики')) continue;
    const rows = sheetRows(workbook, sheetName);
    const dateHeader = rows[2] ?? [];
    const dates = dateHeader.map((value, index) => ({ index, date: excelDate(text(value).replace('Дата зняття ', '')) })).filter((item) => item.date);

    for (let rowIndex = 3; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];
      const meterNumber = text(row[0]);
      const utilityLabel = text(row[1]);
      if (!meterNumber || meterNumber.toLowerCase().includes('використано') || !utilityLabel) continue;
      const coefficient = num(row[2]) ?? 1;
      const storeCodeMatch = text(rows[0]?.[3]).match(/№\s*([0-9/]+)/);
      const storeCode = storeCodeMatch ? `М${storeCodeMatch[1]}` : '';
      const point = {
        storeCode,
        storeLabel: text(rows[0]?.[3]),
        addressLine: '',
        ownerKind: sheetName.toLowerCase().includes('арендат') ? 'tenant' : 'store',
        tenantName: '',
        legalEntity: '',
        providerName: '',
        contractNumber: '',
        utilityType: utilityType(utilityLabel),
        utilityLabel,
        meterNumber,
        coefficient,
        areaSqM: null,
        sourceKey: sourceKey([fileName, sheetName, storeCode, utilityLabel, meterNumber]),
        sourceFile: fileName,
        sourceSheet: sheetName
      };

      for (const column of dates) {
        const readingValue = num(row[column.index]);
        if (readingValue == null) continue;
        records.push({
          point,
          reading: {
            periodMonth: periodMonth(column.date),
            readingDate: column.date,
            readingValue,
            sourceCell: XLSX.utils.encode_cell({ r: rowIndex, c: column.index })
          }
        });
      }
    }
  }
  return records;
}

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false
  });
}

async function upsertRecord(conn, record) {
  const point = record.point;
  const [pointResult] = await conn.execute(
    `
      INSERT INTO utility_meter_points (
        store_code, store_label, address_line, owner_kind, tenant_name, legal_entity, provider_name,
        contract_number, utility_type, utility_label, meter_number, coefficient, area_sq_m,
        source_key, source_file, source_sheet, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        store_code = VALUES(store_code),
        store_label = VALUES(store_label),
        address_line = VALUES(address_line),
        owner_kind = VALUES(owner_kind),
        tenant_name = VALUES(tenant_name),
        legal_entity = VALUES(legal_entity),
        provider_name = VALUES(provider_name),
        contract_number = VALUES(contract_number),
        utility_type = VALUES(utility_type),
        utility_label = VALUES(utility_label),
        meter_number = VALUES(meter_number),
        coefficient = VALUES(coefficient),
        area_sq_m = VALUES(area_sq_m),
        source_file = VALUES(source_file),
        source_sheet = VALUES(source_sheet),
        is_active = 1
    `,
    [
      point.storeCode || null,
      point.storeLabel || null,
      point.addressLine || null,
      point.ownerKind,
      point.tenantName || null,
      point.legalEntity || null,
      point.providerName || null,
      point.contractNumber || null,
      point.utilityType,
      point.utilityLabel,
      point.meterNumber || null,
      point.coefficient ?? 1,
      point.areaSqM,
      point.sourceKey,
      point.sourceFile,
      point.sourceSheet
    ]
  );

  let pointId = pointResult.insertId;
  if (!pointId) {
    const [rows] = await conn.execute('SELECT id FROM utility_meter_points WHERE source_key = ? LIMIT 1', [point.sourceKey]);
    pointId = rows[0].id;
  }

  if (record.rate?.rate != null) {
    await conn.execute(
      `
        INSERT INTO utility_meter_rates (meter_point_id, utility_type, period_month, rate, source_file, source_sheet)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE rate = VALUES(rate), source_file = VALUES(source_file), source_sheet = VALUES(source_sheet)
      `,
      [pointId, point.utilityType, record.rate.periodMonth, record.rate.rate, point.sourceFile, point.sourceSheet]
    );
  }

  await conn.execute(
    `
      INSERT INTO utility_meter_readings (
        meter_point_id, period_month, reading_date, reading_value, source_kind, source_file, source_sheet, source_cell, status
      )
      VALUES (?, ?, ?, ?, 'excel_import', ?, ?, ?, 'approved')
      ON DUPLICATE KEY UPDATE
        reading_date = VALUES(reading_date),
        reading_value = VALUES(reading_value),
        source_file = VALUES(source_file),
        source_sheet = VALUES(source_sheet),
        source_cell = VALUES(source_cell),
        status = 'approved'
    `,
    [
      pointId,
      record.reading.periodMonth,
      record.reading.readingDate,
      record.reading.readingValue,
      point.sourceFile,
      point.sourceSheet,
      record.reading.sourceCell
    ]
  );
}

async function main() {
  const files = XLSX.readFile ? (await import('node:fs')).readdirSync(docsDir).filter((item) => item.endsWith('.xlsx')) : [];
  const allRecords = [];
  const byFile = [];

  for (const file of files) {
    const fullPath = path.join(docsDir, file);
    const workbook = XLSX.readFile(fullPath, { cellDates: true });
    const records = [
      ...parseSubleaseWorkbook(file, workbook),
      ...parseExpenseSheets(file, workbook),
      ...parseMeterBook(file, workbook)
    ];
    allRecords.push(...records);
    byFile.push({ file, sheets: workbook.SheetNames.length, records: records.length });
  }

  const pointKeys = new Set(allRecords.map((record) => record.point.sourceKey));
  const rateCount = allRecords.filter((record) => record.rate?.rate != null).length;
  const invalidReadings = allRecords.filter((record) => !record.reading?.periodMonth || !record.reading?.readingDate);
  const invalidRates = allRecords.filter((record) => record.rate?.rate != null && !record.rate.periodMonth);
  console.log(
    JSON.stringify(
      {
        dryRun: !apply,
        docsDir,
        files: byFile,
        meterPoints: pointKeys.size,
        readings: allRecords.length,
        rates: rateCount,
        invalidReadings: invalidReadings.length,
        invalidRates: invalidRates.length,
        invalidSamples: [...invalidReadings, ...invalidRates].slice(0, 10).map((record) => ({
          sourceFile: record.point.sourceFile,
          sourceSheet: record.point.sourceSheet,
          sourceCell: record.reading?.sourceCell,
          meterNumber: record.point.meterNumber,
          readingDate: record.reading?.readingDate,
          periodMonth: record.reading?.periodMonth,
          ratePeriodMonth: record.rate?.periodMonth
        }))
      },
      null,
      2
    )
  );

  if (!apply) return;

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    for (const record of allRecords) {
      await upsertRecord(conn, record);
    }
    await conn.commit();
    console.log(`Imported ${allRecords.length} readings into ${pointKeys.size} meter points.`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
