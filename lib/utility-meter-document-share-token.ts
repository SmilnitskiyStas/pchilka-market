import { createHmac, timingSafeEqual } from 'crypto';

export type UtilityMeterDocumentShareTokenPayload = {
  periodMonth: string;
  storeId: string;
  storeIds: string;
  audience: 'stores' | 'tenants';
  issuedAt: number;
  expiresAt: number;
};

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createUtilityMeterDocumentShareToken(
  payloadInput: { periodMonth: string; storeId?: string | number | null; storeIds?: string | string[] | null; audience?: 'stores' | 'tenants' },
  secret: string,
  ttlMs = 1000 * 60 * 60 * 24 * 14
): string {
  const payload: UtilityMeterDocumentShareTokenPayload = {
    periodMonth: String(payloadInput.periodMonth ?? '').trim(),
    storeId: String(payloadInput.storeId ?? '').trim(),
    storeIds: Array.isArray(payloadInput.storeIds) ? payloadInput.storeIds.join(',') : String(payloadInput.storeIds ?? '').trim(),
    audience: payloadInput.audience === 'tenants' ? 'tenants' : 'stores',
    issuedAt: Date.now(),
    expiresAt: Date.now() + ttlMs
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encoded, secret);
  return `${encoded}.${signature}`;
}

export function parseUtilityMeterDocumentShareToken(
  token: string | undefined,
  secret: string
): UtilityMeterDocumentShareTokenPayload | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  const given = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as UtilityMeterDocumentShareTokenPayload;
    if (!/^\d{4}-\d{2}-01$/.test(String(payload.periodMonth ?? ''))) return null;
    if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) return null;
    return {
      periodMonth: payload.periodMonth,
      storeId: String(payload.storeId ?? ''),
      storeIds: String(payload.storeIds ?? ''),
      audience: payload.audience === 'tenants' ? 'tenants' : 'stores',
      issuedAt: Number(payload.issuedAt ?? 0),
      expiresAt: payload.expiresAt
    };
  } catch {
    return null;
  }
}
