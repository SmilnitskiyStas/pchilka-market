import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { listOwnBrandPizzas, saveOwnBrandPizzas, type OwnBrandPizzaRecord } from '@/lib/own-brand-pizzas';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const pizzas = await listOwnBrandPizzas();
    return NextResponse.json({ ok: true, pizzas });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown own-brand pizza load error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as { pizzas?: OwnBrandPizzaRecord[] };
    const pizzas = Array.isArray(body?.pizzas) ? body.pizzas : [];
    const savedPizzas = await saveOwnBrandPizzas(pizzas);
    return NextResponse.json({ ok: true, pizzas: savedPizzas });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown own-brand pizza save error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
