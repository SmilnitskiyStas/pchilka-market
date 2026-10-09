import { NextRequest, NextResponse } from 'next/server';

import { findPublicProductByCode } from '@/lib/public-product-info-repository';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') ?? '';

  if (!code.trim()) {
    return NextResponse.json({ error: 'Вкажіть штрихкод або код товару.' }, { status: 400 });
  }

  try {
    const product = await findPublicProductByCode(code);
    if (!product) {
      return NextResponse.json({ error: 'Товар за вказаним кодом не знайдено.' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Public product lookup failed', error);
    return NextResponse.json({ error: 'Не вдалося виконати пошук товару. Спробуйте пізніше.' }, { status: 503 });
  }
}
