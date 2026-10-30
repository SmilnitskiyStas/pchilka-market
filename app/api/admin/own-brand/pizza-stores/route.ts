import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getPizzaStoreEditorData, listPizzaStoreOptions, savePizzaStoreIds } from '@/lib/own-brand-pizza-stores';
import { normalizePizzaStoreIds } from '@/lib/pizza-store-selection';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try { return NextResponse.json({ ok: true, ...await getPizzaStoreEditorData() }); }
  catch { return NextResponse.json({ ok: false, error: 'Не вдалося завантажити магазини.' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  let storeIds: string[];
  try { storeIds = normalizePizzaStoreIds((await request.json()).storeIds); }
  catch { return NextResponse.json({ ok: false, error: 'Перевірте вибір магазинів.' }, { status: 400 }); }
  try {
    const available = new Set((await listPizzaStoreOptions()).map((store) => store.id));
    if (storeIds.some((id) => !available.has(id))) return NextResponse.json({ ok: false, error: 'Деякі магазини вже неактивні або видалені. Оновіть список і повторіть вибір.' }, { status: 400 });
    const saved = await savePizzaStoreIds(storeIds);
    revalidatePath('/own-brand/pizza-coffeehouse');
    return NextResponse.json({ ok: true, storeIds: saved });
  } catch { return NextResponse.json({ ok: false, error: 'Не вдалося зберегти вибір магазинів.' }, { status: 500 }); }
}
