import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { createInventoryNotificationLogInDb } from '@/lib/inventory-notification-logs-repository';
import {
  sendInventoryTelegramDocument,
  sendInventoryTelegramMessage
} from '@/lib/inventory-telegram-api';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { listInventoryUsersFromDb } from '@/lib/inventory-users-repository';
import type { InventoryUserRole } from '@/lib/inventory-user-roles';

export const runtime = 'nodejs';

type BroadcastRole = Extract<InventoryUserRole, 'store_manager' | 'manager'>;

const MAX_BROADCAST_FILES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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

function buildLogText(messageText: string, fileNames: string[]) {
  if (fileNames.length === 0) return messageText;
  return `${messageText}\n\n[files] ${fileNames.join(', ')}`;
}

function parseRecipientRoles(raw: FormDataEntryValue | null): BroadcastRole[] {
  if (typeof raw !== 'string' || !raw.trim()) {
    return ['store_manager', 'manager'];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return ['store_manager', 'manager'];
    const roles = parsed.filter(isBroadcastRole);
    return roles.length > 0 ? Array.from(new Set(roles)) : ['store_manager', 'manager'];
  } catch {
    return ['store_manager', 'manager'];
  }
}

function normalizeFiles(entries: FormDataEntryValue[]) {
  const files = entries.filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > MAX_BROADCAST_FILES) {
    throw new Error(`Можна додати не більше ${MAX_BROADCAST_FILES} файлів за раз.`);
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Файл ${file.name} завеликий. Максимум 10MB на файл.`);
    }
  }

  return files;
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const formData = await request.formData();
    const storeIdRaw = formData.get('storeId');
    const titleRaw = formData.get('title');
    const messageTextRaw = formData.get('messageText');
    const recipientRolesRaw = formData.get('recipientRoles');
    const files = normalizeFiles(formData.getAll('files'));

    const normalizedStoreId =
      typeof storeIdRaw === 'string' && storeIdRaw.trim() ? Number(storeIdRaw) : null;
    const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : 'Оновлення';
    const messageText = typeof messageTextRaw === 'string' ? messageTextRaw.trim() : '';
    const recipientRoles = parseRecipientRoles(recipientRolesRaw);

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

    const fileNames = files.map((file) => file.name);
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

        for (const file of files) {
          await sendInventoryTelegramDocument({
            botToken: settings.botToken,
            chatId: recipient.userChatId,
            file,
            fileName: file.name,
            caption: `Вкладення: ${file.name}`
          });
        }

        await createInventoryNotificationLogInDb({
          storeId: recipient.storeId,
          userId: recipient.id,
          notificationType: 'inventory_manual_broadcast',
          messageText: buildLogText(text, fileNames)
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
      attachedFiles: fileNames,
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
