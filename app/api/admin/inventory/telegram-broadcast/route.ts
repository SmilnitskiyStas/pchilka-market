import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { createInventoryNotificationLogInDb } from '@/lib/inventory-notification-logs-repository';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { sendInventoryTelegramMessage } from '@/lib/inventory-telegram-api';
import { listInventoryUsersFromDb } from '@/lib/inventory-users-repository';
import type { InventoryUserRole } from '@/lib/inventory-user-roles';

export const runtime = 'nodejs';

type BroadcastRole = Extract<InventoryUserRole, 'store_manager' | 'manager'>;

type BroadcastRequestBody = {
  storeId?: string | number | null;
  title?: string;
  messageText?: string;
  recipientRoles?: BroadcastRole[];
};

function isBroadcastRole(value: unknown): value is BroadcastRole {
  return value === 'store_manager' || value === 'manager';
}

function formatRoleLabel(role: BroadcastRole) {
  return role === 'store_manager' ? 'керівник магазину' : 'менеджер';
}

function buildBroadcastText(input: {
  title: string;
  messageText: string;
  storeLabel: string;
  recipientRoles: BroadcastRole[];
}) {
  const rolesLabel = input.recipientRoles.map(formatRoleLabel).join(', ');

  return [
    `Оновлення для ролей: ${rolesLabel}.`,
    input.storeLabel ? `Магазин: ${input.storeLabel}` : 'Магазин: усі доступні магазини.',
    '',
    input.title,
    input.messageText
  ]
    .filter(Boolean)
    .join('\n');
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as BroadcastRequestBody;
    const normalizedStoreId = body.storeId == null || body.storeId === '' ? null : Number(body.storeId);
    const title = String(body.title ?? '').trim() || 'Оновлення';
    const messageText = String(body.messageText ?? '').trim();
    const requestedRoles = Array.isArray(body.recipientRoles) ? body.recipientRoles.filter(isBroadcastRole) : [];
    const recipientRoles: BroadcastRole[] =
      requestedRoles.length > 0 ? Array.from(new Set(requestedRoles)) : ['store_manager', 'manager'];

    if (!messageText) {
      return NextResponse.json({ ok: false, error: 'Введіть текст повідомлення.' }, { status: 400 });
    }
    if (normalizedStoreId != null && (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0)) {
      return NextResponse.json({ ok: false, error: 'Некоректний магазин.' }, { status: 400 });
    }
    if (recipientRoles.length === 0) {
      return NextResponse.json({ ok: false, error: 'Оберіть хоча б одну роль отримувача.' }, { status: 400 });
    }

    const settings = await getInventoryTelegramSettingsFromDb();
    if (!settings.enabled || !settings.botToken) {
      return NextResponse.json(
        { ok: false, error: 'Telegram інтеграція не налаштована або вимкнена.' },
        { status: 400 }
      );
    }

    const users = await listInventoryUsersFromDb({
      storeId: normalizedStoreId,
      limit: normalizedStoreId ? 300 : 500
    });

    const recipients = users.filter(
      (user) => user.isActive && Boolean(user.userChatId) && isBroadcastRole(user.role) && recipientRoles.includes(user.role)
    );

    if (recipients.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Не знайдено активних отримувачів з Telegram chat id для вибраних ролей.' },
        { status: 404 }
      );
    }

    const uniqueRecipients = recipients.filter(
      (recipient, index, items) => items.findIndex((item) => item.id === recipient.id) === index
    );

    let sentCount = 0;
    const failedRecipients: Array<{ userId: number; name: string; error: string }> = [];

    for (const recipient of uniqueRecipients) {
      const text = buildBroadcastText({
        title,
        messageText,
        storeLabel: recipient.storeLabel,
        recipientRoles
      });

      try {
        await sendInventoryTelegramMessage({
          botToken: settings.botToken,
          chatId: recipient.userChatId,
          text
        });

        await createInventoryNotificationLogInDb({
          storeId: recipient.storeId,
          userId: recipient.id,
          notificationType: 'inventory_manual_broadcast',
          messageText: text
        });

        sentCount += 1;
      } catch (error) {
        failedRecipients.push({
          userId: recipient.id,
          name: [recipient.surname, recipient.name].filter(Boolean).join(' ').trim() || `#${recipient.id}`,
          error: error instanceof Error ? error.message : 'Невідома помилка Telegram.'
        });
      }
    }

    if (sentCount === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: failedRecipients[0]?.error || 'Не вдалося надіслати жодного повідомлення.',
          failedRecipients
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      sentCount,
      failedCount: failedRecipients.length,
      recipients: uniqueRecipients.map((recipient) => ({
        id: recipient.id,
        name: [recipient.surname, recipient.name].filter(Boolean).join(' ').trim(),
        role: recipient.role,
        storeLabel: recipient.storeLabel
      })),
      failedRecipients
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося надіслати Telegram-повідомлення.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
