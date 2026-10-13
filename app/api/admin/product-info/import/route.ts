import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { emptyProductInfoDetails, type ProductInfoDetails } from '@/lib/public-product-info-fields';
import { findProductByCode, saveProductDetails } from '../route';

export const runtime = 'nodejs';

const headers: Record<string, keyof ProductInfoDetails | 'barcode' | 'article'> = {
  'Назва товару': 'originalName', 'Назва мовою оригіналу': 'originalName', 'Артикул': 'article', 'Штрихкод': 'barcode',
  'Категорія': 'category', 'Одиниця вимірювання': 'unit', 'Маса нетто /обєм/кількість в упаковці': 'netQuantity', 'Маса нетто /об’єм/кількість в упаковці': 'netQuantity',
  'Маса нетто без урахування глазурі': 'netWeightWithoutGlaze', 'Фактичний вміст алкоголю': 'alcoholContent', 'Переглік інгредієнтів': 'ingredients', 'Перелік інгредієнтів': 'ingredients',
  'Алергени': 'allergens', "Обов'язкові застереження": 'mandatoryWarnings', 'Обов’язкові застереження': 'mandatoryWarnings', 'Наявність ГМО': 'isGmoFree',
  'Статус заморожування / розморожування': 'freezingStatus', 'Інші обов’язкові відомості про склад або характеристики': 'additionalCharacteristics',
  'Енергетична цінність': 'nutritionEnergy', 'Жири': 'nutritionFat', 'Насичені жири': 'nutritionSaturatedFat', 'Вуглеводи': 'nutritionCarbohydrates', 'Цукри': 'nutritionSugars', 'Білок': 'nutritionProtein', 'Сіль': 'nutritionSalt', 'Вітаміни': 'vitamins',
  'Мінімальний термін придатності': 'shelfLife', 'Умови зберігання до відкриття упаковки (температура, вологість)': 'storageBeforeOpening', 'Умови зберігання після відкриття': 'storageAfterOpening', 'Гарантований строк споживання після відкриття': 'consumptionPeriodAfterOpening',
  'Повне найменування виробника': 'manufacturer', 'Країна походження, адрес, e-mail': 'countryOfOrigin', 'Повне найменування імпортера': 'importer', 'Адреса, телефон, email, код ЄДРПОУ/РНОКПП': 'importerContact',
  'Повне найменування постачальника': 'supplier', 'Адреса, телефон, email, код ЄДРПОУ/РНОКПП ': 'supplierContact', 'Приймає претензії від споживачів': 'consumerClaims'
};

function value(cell: unknown) { return String(cell ?? '').trim(); }
function gmo(valueInput: string) { return /без\s*гмо|так|yes/i.test(valueInput) && !/ні|no/i.test(valueInput); }

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File) || !/\.(xlsx|xls)$/i.test(file.name)) return NextResponse.json({ ok: false, error: 'Оберіть Excel-файл у форматі .xlsx або .xls.' }, { status: 400 });
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]]; if (!sheet) throw new Error('У файлі немає аркуша з даними.');
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
    const headerIndex = rows.findIndex((row) => Array.isArray(row) && row.some((cell) => value(cell) === 'Артикул') && row.some((cell) => value(cell) === 'Штрихкод'));
    if (headerIndex < 0) throw new Error('Не знайдено рядок заголовків з колонками «Артикул» і «Штрихкод».');
    const mapped = (rows[headerIndex] as unknown[]).map((cell, column) => {
      const heading = value(cell); const group = value((rows[headerIndex - 1] as unknown[])[column]);
      if (heading === 'Адреса, телефон, email, код ЄДРПОУ/РНОКПП') return group.includes('постачальника') ? 'supplierContact' : 'importerContact';
      return headers[heading];
    });
    const report = { imported: 0, skipped: 0, notFound: [] as string[], errors: [] as string[] };
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index] as unknown[]; const article = value(row[mapped.indexOf('article')]); const barcode = value(row[mapped.indexOf('barcode')]);
      if (!article && !barcode) continue;
      try {
        const product = await findProductByCode(barcode || article);
        if (!product) { report.notFound.push(`Рядок ${index + 1}: ${article || barcode}`); report.skipped += 1; continue; }
        const details = emptyProductInfoDetails();
        mapped.forEach((field, column) => { if (!field || field === 'article' || field === 'barcode') return; const cellValue = value(row[column]); if (field === 'isGmoFree') details.isGmoFree = gmo(cellValue); else details[field] = cellValue; });
        await saveProductDetails(product.id, details); report.imported += 1;
      } catch (error) { report.skipped += 1; report.errors.push(`Рядок ${index + 1}: ${error instanceof Error ? error.message : 'невідома помилка'}`); }
    }
    return NextResponse.json({ ok: true, report });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося імпортувати файл.' }, { status: 500 }); }
}
