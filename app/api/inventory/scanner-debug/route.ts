import { NextResponse } from 'next/server';

import {
  INVENTORY_AUTH_DEBUG_ACTION_TYPES,
  writeInventoryAuthDebugLog,
  type InventoryAuthDebugActionType
} from '@/lib/inventory-auth-debug';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';

export const runtime = 'nodejs';

const scannerActionTypes = new Set<InventoryAuthDebugActionType>(
  INVENTORY_AUTH_DEBUG_ACTION_TYPES.filter((actionType) => actionType.startsWith('inventory_scanner_'))
);

function sanitizeMeta(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, 30)) {
    const key = rawKey.trim().slice(0, 60);
    if (!key || /token|secret|authorization/i.test(key)) continue;

    if (typeof rawValue === 'string') {
      sanitized[key] = rawValue.slice(0, 500);
    } else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      sanitized[key] = rawValue;
    } else if (typeof rawValue === 'boolean' || rawValue === null) {
      sanitized[key] = rawValue;
    }
  }
  return sanitized;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 12_000) {
      return NextResponse.json({ ok: false, error: 'Payload is too large.' }, { status: 413 });
    }

    const body = (await request.json()) as { token?: unknown; actionType?: unknown; meta?: unknown };
    const token = String(body.token ?? '').trim();
    const actionType = String(body.actionType ?? '').trim() as InventoryAuthDebugActionType;
    if (!token || !scannerActionTypes.has(actionType)) {
      return NextResponse.json({ ok: false, error: 'Invalid scanner debug event.' }, { status: 400 });
    }

    const user = await resolveInventorySessionUserFromToken(token);
    await writeInventoryAuthDebugLog({
      actionType,
      userId: user.id,
      storeId: user.storeId,
      meta: {
        ...sanitizeMeta(body.meta),
        userAgent: String(request.headers.get('user-agent') ?? '').slice(0, 500)
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scanner debug event failed.';
    const isAccessError = /токен|користувача|обліковий запис/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: isAccessError ? 401 : 500 });
  }
}
