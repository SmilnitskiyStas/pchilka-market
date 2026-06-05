import { createHmac, timingSafeEqual } from 'crypto';

export type InventoryRegistrationTokenPayload = {
  chatId: string;
  firstName: string;
  lastName: string;
  username: string;
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

export function createInventoryRegistrationToken(
  payloadInput: Omit<InventoryRegistrationTokenPayload, 'issuedAt' | 'expiresAt'>,
  secret: string,
  ttlMs = 1000 * 60 * 60 * 24 * 7
): string {
  const payload: InventoryRegistrationTokenPayload = {
    ...payloadInput,
    issuedAt: Date.now(),
    expiresAt: Date.now() + ttlMs
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encoded, secret);
  return `${encoded}.${signature}`;
}

export function parseInventoryRegistrationToken(
  token: string | undefined,
  secret: string
): InventoryRegistrationTokenPayload | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  const given = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as InventoryRegistrationTokenPayload;
    if (!payload.chatId || typeof payload.chatId !== 'string') return null;
    if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}
