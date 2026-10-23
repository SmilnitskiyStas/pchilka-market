import path from 'node:path';

import XLSX from 'xlsx';

const PERIOD_FILE_RE = /^(Старий|Новий)\s+з\s+(\d{1,2})\.(\d{1,2})\s+по\s+(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\.xlsx$/iu;
const PLAIN_FILE_RE = /^(Старий|Новий)\.xlsx$/iu;

function fullYear(year) {
  const numeric = Number(year);
  return String(year).length === 2 ? 2000 + numeric : numeric;
}

function utcDate(day, month, year) {
  const value = new Date(Date.UTC(fullYear(year), Number(month) - 1, Number(day)));
  if (
    value.getUTCFullYear() !== fullYear(year)
    || value.getUTCMonth() !== Number(month) - 1
    || value.getUTCDate() !== Number(day)
  ) {
    throw new Error(`Некоректна дата: ${day}.${month}.${year}`);
  }
  return value;
}

export function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime());
  const match = String(value ?? '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/u);
  if (!match) throw new Error(`Дата повинна мати формат ДД.ММ.РР: ${value}`);
  return utcDate(match[1], match[2], match[3]);
}

export function formatDate(date) {
  return [
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCFullYear()).slice(-2),
  ].join('.');
}

export function formatPeriod(start, end) {
  const startText = [
    String(start.getUTCDate()).padStart(2, '0'),
    String(start.getUTCMonth() + 1).padStart(2, '0'),
  ].join('.');
  return `${startText}–${formatDate(end)}`;
}

export function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function parsePeriodFilename(filePath) {
  const fileName = path.basename(filePath);
  const match = fileName.match(PERIOD_FILE_RE);
  const plainMatch = fileName.match(PLAIN_FILE_RE);
  if (!match && !plainMatch) return null;
  const kind = (match?.[1] ?? plainMatch[1]).toLocaleLowerCase('uk-UA') === 'старий' ? 'old' : 'new';
  if (!match) return { kind, fileName, start: null, end: null };
  const [, , startDay, startMonth, endDay, endMonth, year] = match;
  const end = utcDate(endDay, endMonth, year);
  let start = utcDate(startDay, startMonth, year);
  if (start > end) start = utcDate(startDay, startMonth, fullYear(year) - 1);
  return {
    kind,
    fileName,
    start,
    end,
  };
}

function resolvePeriod(filePeriod, override, label) {
  if (override?.start && override?.end) {
    const start = parseDate(override.start);
    const end = parseDate(override.end);
    if (start > end) throw new Error(`Початок ${label} періоду пізніше завершення.`);
    return { ...filePeriod, start, end };
  }
  if (override?.start || override?.end) throw new Error(`Для ${label} періоду потрібно вказати обидві дати.`);
  if (!filePeriod.start || !filePeriod.end) {
    throw new Error(`Для файла «${filePeriod.fileName}» потрібно передати дати запуску.`);
  }
  return filePeriod;
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

function keyText(value) {
  return text(value).toLocaleLowerCase('uk-UA').replace(/\s+/gu, ' ');
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readRows(filePath) {
  const workbook = XLSX.readFile(filePath, { raw: true, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error(`У файлі немає аркушів: ${filePath}`);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
  });
  return { sheetName, rows };
}

function findProductColumns(rows) {
  const codeRow = rows[0] ?? [];
  const nameRow = rows[2] ?? [];
  const starts = [];
  for (let column = 1; column < Math.max(codeRow.length, nameRow.length); column += 1) {
    const code = text(codeRow[column]);
    const name = text(nameRow[column]);
    if (code.toLocaleLowerCase('uk-UA') === 'итого' || code.toLocaleLowerCase('uk-UA') === 'разом') break;
    if (name) starts.push(column);
  }
  return starts;
}

function findFieldColumn(headerRow, start, end, matcher) {
  for (let column = start; column < end; column += 1) {
    if (matcher(keyText(headerRow[column]))) return column;
  }
  return null;
}

export function parseSourceWorkbook(filePath, options = {}) {
  const requireBalance = options.requireBalance !== false;
  const { sheetName, rows } = readRows(filePath);
  if (rows.length < 6) throw new Error(`Невідома структура звіту: ${filePath}`);
  const productStarts = findProductColumns(rows);
  const codeRow = rows[0] ?? [];
  const nameRow = rows[2] ?? [];
  const fieldRow = rows[4] ?? [];
  const products = productStarts.map((start, index) => {
    const end = productStarts[index + 1] ?? fieldRow.length;
    const quantityColumn = findFieldColumn(fieldRow, start, end, (value) => value.includes('количество продажи'));
    const balanceColumn = findFieldColumn(fieldRow, start, end, (value) => value.includes('остаток за вычетом'));
    if (quantityColumn == null) {
      throw new Error(`Не знайдено колонку «Количество продажи» для товару «${text(nameRow[start])}» у ${path.basename(filePath)}.`);
    }
    if (requireBalance && balanceColumn == null) {
      const foundHeaders = fieldRow.slice(start, end).map(text).filter(Boolean).join(', ');
      throw new Error(
        `У файлі ${path.basename(filePath)} для товару «${text(nameRow[start])}» немає кількісної колонки залишку `
        + '«Остаток за вычетом текущих продаж». '
        + `Знайдені колонки: ${foundHeaders || 'немає'}. `
        + '«Себестоимость (начальный остаток)» є грошовою собівартістю і не може використовуватися як залишок товару. '
        + 'Повторіть вивантаження нового звіту з колонкою кількісного залишку.',
      );
    }
    return {
      code: codeRow[start],
      name: text(nameRow[start]),
      quantityColumn,
      balanceColumn,
    };
  });

  const stores = [];
  for (let rowIndex = 5; rowIndex < rows.length; rowIndex += 1) {
    const name = text(rows[rowIndex]?.[0]);
    if (!keyText(name).startsWith('магазин')) continue;
    const values = new Map();
    products.forEach((product) => {
      values.set(productKey(product), {
        quantity: numeric(rows[rowIndex]?.[product.quantityColumn]),
        balance: product.balanceColumn == null ? null : numeric(rows[rowIndex]?.[product.balanceColumn]),
      });
    });
    stores.push({ name, key: keyText(name), values });
  }
  return { filePath, sheetName, products, stores };
}

export function productKey(product) {
  return `${keyText(product.code)}::${keyText(product.name)}`;
}

export function mergeProducts(oldProducts, newProducts) {
  const result = oldProducts.map((product) => ({
    ...product,
    inOld: true,
    inNew: false,
    oldKey: productKey(product),
    newKey: null,
  }));
  for (const newProduct of newProducts) {
    let index = result.findIndex((product) => productKey(product) === productKey(newProduct));
    if (index < 0) {
      const sameName = result.filter((product) => keyText(product.name) === keyText(newProduct.name));
      if (sameName.length === 1) index = result.indexOf(sameName[0]);
    }
    if (index >= 0) {
      result[index].inNew = true;
      result[index].newKey = productKey(newProduct);
    } else {
      result.push({
        ...newProduct,
        inOld: false,
        inNew: true,
        oldKey: null,
        newKey: productKey(newProduct),
      });
    }
  }
  return result;
}

export function mergeStores(oldStores, newStores) {
  const result = oldStores.map((store) => ({ name: store.name, key: store.key, inOld: true, inNew: false }));
  for (const newStore of newStores) {
    const existing = result.find((store) => store.key === newStore.key);
    if (existing) existing.inNew = true;
    else result.push({ name: newStore.name, key: newStore.key, inOld: false, inNew: true });
  }
  return result;
}

export function buildAnalysis(oldFile, newFile, options = {}) {
  const oldFilePeriod = parsePeriodFilename(oldFile);
  const newFilePeriod = parsePeriodFilename(newFile);
  if (!oldFilePeriod || oldFilePeriod.kind !== 'old') throw new Error(`Некоректна назва старого звіту: ${path.basename(oldFile)}`);
  if (!newFilePeriod || newFilePeriod.kind !== 'new') throw new Error(`Некоректна назва нового звіту: ${path.basename(newFile)}`);
  const oldPeriod = resolvePeriod(oldFilePeriod, options.oldPeriod, 'старого');
  const newPeriod = resolvePeriod(newFilePeriod, options.newPeriod, 'нового');
  // Зі старого періоду потрібні лише продажі. Залишок береться виключно з нового звіту.
  const oldSource = parseSourceWorkbook(oldFile, { requireBalance: false });
  const newSource = parseSourceWorkbook(newFile, { requireBalance: true });
  const products = mergeProducts(oldSource.products, newSource.products);
  const stores = mergeStores(oldSource.stores, newSource.stores);
  return {
    oldPeriod,
    newPeriod,
    balanceDate: addDays(newPeriod.end, 1),
    outputFileName: `Шок ціна з ${formatPeriod(newPeriod.start, newPeriod.end).replace('–', ' по ')}.xlsx`,
    oldSource,
    newSource,
    products,
    stores,
    warnings: [
      ...products.filter((product) => !product.inOld).map((product) => `Товар відсутній у старому звіті: ${product.name}`),
      ...products.filter((product) => !product.inNew).map((product) => `Товар відсутній у новому звіті: ${product.name}`),
      ...stores.filter((store) => !store.inOld).map((store) => `Магазин відсутній у старому звіті: ${store.name}`),
      ...stores.filter((store) => !store.inNew).map((store) => `Магазин відсутній у новому звіті: ${store.name}`),
    ],
  };
}

function valueFor(store, productKeyValue, field) {
  if (!store || !productKeyValue) return null;
  const value = numeric(store.values.get(productKeyValue)?.[field]);
  return value == null ? null : Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function buildSummaryData(analysis) {
  const oldStores = new Map(analysis.oldSource.stores.map((store) => [store.key, store]));
  const newStores = new Map(analysis.newSource.stores.map((store) => [store.key, store]));
  const rows = analysis.stores.map((store) => {
    const oldStore = oldStores.get(store.key);
    const newStore = newStores.get(store.key);
    const products = analysis.products.map((product) => {
      const oldQuantity = valueFor(oldStore, product.oldKey, 'quantity');
      const newQuantity = valueFor(newStore, product.newKey, 'quantity');
      const balance = valueFor(newStore, product.newKey, 'balance');
      return {
        oldQuantity,
        newQuantity,
        coefficient: oldQuantity != null && oldQuantity !== 0 && newQuantity != null
          ? Math.round(newQuantity / oldQuantity)
          : null,
        balance,
      };
    });
    return { name: store.name, products };
  });

  const totals = analysis.products.map((_, productIndex) => {
    const fields = ['oldQuantity', 'newQuantity', 'coefficient', 'balance'];
    return Object.fromEntries(fields.map((field) => {
      const total = rows.reduce((sum, row) => {
        const value = row.products[productIndex][field];
        return typeof value === 'number' && Number.isFinite(value) ? sum + value : sum;
      }, 0);
      return [field, field === 'coefficient' ? total : Math.round((total + Number.EPSILON) * 1000) / 1000];
    }));
  });

  return { rows, totals };
}
