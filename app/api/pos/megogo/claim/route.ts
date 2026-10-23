import { NextResponse } from 'next/server';

import { claimMegogoCode, type MegogoClaimRequest } from '@/lib/megogo-code-issuance';

export const runtime = 'nodejs';

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanAmount(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000 ? amount : null;
}

function cleanRuleCode(value: unknown): number | null {
  const code = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(code) && code > 0 ? code : null;
}

export async function POST(request: Request) {
  const secret = process.env.MEGOGO_POS_API_SECRET?.trim() ?? '';
  const suppliedSecret = request.headers.get('x-megogo-pos-secret')?.trim() ?? '';
  if (!secret || suppliedSecret !== secret) {
    return new NextResponse('', { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return new NextResponse('', { status: 400 });

  const loyaltyCode = cleanString(payload.loyaltyCode, 64);
  const checkTotal = cleanAmount(payload.checkTotal);
  const orderCode = cleanString(payload.orderCode, 64);
  const storeCode = cleanString(payload.storeCode, 64);
  const workplaceId = cleanString(payload.workplaceId, 64);
  const ruleCode = cleanRuleCode(payload.ruleCode);
  const campaignKey = cleanString(payload.campaignKey, 64);

  // Каса може не передавати один із технічних ідентифікаторів чека на етапі
  // застосування правила. Вони важливі для аналітики, але не повинні
  // блокувати вручення коду учаснику, якого вже перевірили за loyaltyCode.
  if (!loyaltyCode || checkTotal === null || !ruleCode || !campaignKey) {
    return new NextResponse('', { status: 400 });
  }

  // Тестовий контур не дозволяє видати код нікому, крім погодженого учасника.
  const testLoyaltyCode = process.env.MEGOGO_TEST_LOYALTY_CODE?.trim() ?? '';
  if (campaignKey === 'megogo-843-test' && (!testLoyaltyCode || loyaltyCode !== testLoyaltyCode)) {
    return new NextResponse('', { status: 403 });
  }

  try {
    const code = await claimMegogoCode({
      campaignKey,
      loyaltyCode,
      checkTotal,
      orderCode,
      storeCode,
      workplaceId,
      ruleCode
    } satisfies MegogoClaimRequest);

    return new NextResponse(code ?? '', {
      status: code ? 200 : 409,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  } catch {
    return new NextResponse('', { status: 500 });
  }
}
