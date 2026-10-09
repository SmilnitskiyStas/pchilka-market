import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getDbPool } from '@/lib/db';

const fields = ['ingredients','fruitContent','nutritionFat','nutritionSaturatedFat','nutritionCarbohydrates','nutritionSugars','nutritionProtein','nutritionSalt','nutritionEnergy','storageConditions','shelfLife','allergens','countryOfOrigin','manufacturer','importer','consumerClaims'] as const;
type Field = (typeof fields)[number];
type ProductRow = RowDataPacket & { id:number; article:string; name:string; barcode:string|null };
type DetailsRow = RowDataPacket & Partial<Record<Field, string>> & { isGmoFree?: number };
type Details = Record<Field, string> & { isGmoFree: boolean };

function normalize(value: unknown) { return String(value ?? '').trim().replace(/\s+/g, '').replace(/\.0+$/, ''); }
function text(value: unknown) { return String(value ?? '').trim(); }
function emptyDetails(): Details { return { ingredients:'', fruitContent:'', nutritionFat:'', nutritionSaturatedFat:'', nutritionCarbohydrates:'', nutritionSugars:'', nutritionProtein:'', nutritionSalt:'', nutritionEnergy:'', storageConditions:'', shelfLife:'', allergens:'', countryOfOrigin:'', manufacturer:'', importer:'', consumerClaims:'', isGmoFree:false }; }

async function findProduct(codeInput: string) {
  const code = normalize(codeInput);
  if (!code || code.length > 120) return null;
  const db = getDbPool();
  const [rows] = await db.query<ProductRow[]>(
    `SELECT p.id, p.article, p.product_name AS name, pb.barcode FROM products p LEFT JOIN product_barcodes pb ON pb.product_id=p.id AND REPLACE(TRIM(COALESCE(pb.barcode,'')), ' ', '')=? WHERE p.is_active=1 AND (pb.id IS NOT NULL OR REPLACE(TRIM(COALESCE(p.article,'')), ' ', '')=?) ORDER BY p.id LIMIT 1`, [code, code]
  );
  return rows[0] ?? null;
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  const code = new URL(request.url).searchParams.get('code') ?? '';
  try {
    const product = await findProduct(code);
    if (!product) return NextResponse.json({ ok:false, error:'Товар не знайдено.' }, { status:404 });
    const db = getDbPool();
    const [rows] = await db.query<DetailsRow[]>(`SELECT ingredients, fruit_content AS fruitContent, nutrition_fat AS nutritionFat, nutrition_saturated_fat AS nutritionSaturatedFat, nutrition_carbohydrates AS nutritionCarbohydrates, nutrition_sugars AS nutritionSugars, nutrition_protein AS nutritionProtein, nutrition_salt AS nutritionSalt, nutrition_energy AS nutritionEnergy, storage_conditions AS storageConditions, shelf_life AS shelfLife, allergens, country_of_origin AS countryOfOrigin, manufacturer, importer, consumer_claims AS consumerClaims, is_gmo_free AS isGmoFree FROM public_product_info WHERE product_id=? LIMIT 1`, [product.id]);
    return NextResponse.json({ ok:true, product, details:{ ...emptyDetails(), ...(rows[0] ?? {}), isGmoFree:Boolean(rows[0]?.isGmoFree) } });
  } catch (error) { return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'Помилка завантаження.' }, { status:500 }); }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const body = await request.json() as { code?:string; details?:Partial<Details> };
    const product = await findProduct(body.code ?? '');
    if (!product) return NextResponse.json({ ok:false, error:'Товар не знайдено.' }, { status:404 });
    const details = { ...emptyDetails(), ...(body.details ?? {}) };
    const values = fields.map((field) => text(details[field]));
    await getDbPool().query(`INSERT INTO public_product_info (product_id, ingredients, fruit_content, nutrition_fat, nutrition_saturated_fat, nutrition_carbohydrates, nutrition_sugars, nutrition_protein, nutrition_salt, nutrition_energy, storage_conditions, shelf_life, allergens, country_of_origin, manufacturer, importer, consumer_claims, is_gmo_free) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ingredients=VALUES(ingredients), fruit_content=VALUES(fruit_content), nutrition_fat=VALUES(nutrition_fat), nutrition_saturated_fat=VALUES(nutrition_saturated_fat), nutrition_carbohydrates=VALUES(nutrition_carbohydrates), nutrition_sugars=VALUES(nutrition_sugars), nutrition_protein=VALUES(nutrition_protein), nutrition_salt=VALUES(nutrition_salt), nutrition_energy=VALUES(nutrition_energy), storage_conditions=VALUES(storage_conditions), shelf_life=VALUES(shelf_life), allergens=VALUES(allergens), country_of_origin=VALUES(country_of_origin), manufacturer=VALUES(manufacturer), importer=VALUES(importer), consumer_claims=VALUES(consumer_claims), is_gmo_free=VALUES(is_gmo_free)`, [product.id, ...values, details.isGmoFree ? 1 : 0]);
    return NextResponse.json({ ok:true, product });
  } catch (error) { return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'Помилка збереження.' }, { status:500 }); }
}

