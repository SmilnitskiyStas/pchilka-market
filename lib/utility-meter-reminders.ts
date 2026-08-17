import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { createInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { sendInventoryTelegramMessage } from '@/lib/inventory-telegram-api';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';

type MissingMeterRow = RowDataPacket & {
  user_id: number;
  user_chat_id: string | number;
  user_name: string;
  user_surname: string;
  store_id: number;
  store_code: string | null;
  store_city: string | null;
  store_address: string | null;
  meter_id: number;
  utility_type: string;
  utility_label: string;
  meter_number: string | null;
};

type ReminderRecipient = {
  userId: number;
  chatId: string;
  name: string;
  surname: string;
  storeId: number;
  storeLabel: string;
  meters: Array<{ id: number; label: string }>;
};

export type UtilityMeterRemindersRunResult = {
  periodMonth: string;
  candidates: number;
  missingMeters: number;
  notificationsSent: number;
  skippedAlreadySent: number;
  failed: number;
  details: Array<{ userId: number; storeLabel: string; missingMeters: number; status: 'sent' | 'skipped' | 'failed'; error?: string }>;
};

function currentPeriodMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function utilityTypeLabel(value: string) {
  switch (value) {
    case 'electricity_active':
      return 'Електроенергія (активна)';
    case 'electricity_reactive':
      return 'Електроенергія (реактивна)';
    case 'water':
      return 'Вода';
    case 'waste':
      return 'Вивіз відходів';
    case 'maintenance':
      return 'Обслуговування';
    case 'rent':
      return 'Оренда';
    default:
      return 'Інше';
  }
}

function meterLabel(row: MissingMeterRow) {
  return [utilityTypeLabel(row.utility_type), row.utility_label, row.meter_number ? `№${row.meter_number}` : '']
    .filter(Boolean)
    .join(' · ');
}

async function ensureUtilityMeterReminderSchema() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utility_meter_reminder_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      recipient_user_id BIGINT UNSIGNED NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      period_month DATE NOT NULL,
      reminder_date DATE NOT NULL,
      missing_meters_count INT UNSIGNED NOT NULL DEFAULT 0,
      status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
      error_message VARCHAR(1000) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_utility_meter_reminders_user_period_day (recipient_user_id, period_month, reminder_date),
      KEY idx_utility_meter_reminders_store_period (store_id, period_month),
      CONSTRAINT fk_utility_meter_reminders_user FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_utility_meter_reminders_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function listRecipientsWithMissingReadings(periodMonth: string): Promise<ReminderRecipient[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<MissingMeterRow[]>(
    `
      SELECT
        u.id AS user_id,
        u.user_chat_id,
        u.name AS user_name,
        u.surname AS user_surname,
        s.id AS store_id,
        s.store_code,
        s.city AS store_city,
        s.address_line AS store_address,
        p.id AS meter_id,
        p.utility_type,
        p.utility_label,
        p.meter_number
      FROM users u
      INNER JOIN stores s ON s.id = u.store_id AND s.is_active = 1
      INNER JOIN utility_meter_points p ON p.store_id = s.id AND p.is_active = 1
      LEFT JOIN utility_meter_readings r
        ON r.meter_point_id = p.id AND r.period_month = ? AND r.status IN ('submitted', 'approved')
      WHERE u.is_active = 1
        AND u.role = 'store_manager'
        AND u.user_chat_id IS NOT NULL
        AND TRIM(CAST(u.user_chat_id AS CHAR)) <> ''
        AND r.id IS NULL
      ORDER BY u.id, p.utility_type, p.utility_label, p.id
    `,
    [periodMonth]
  );

  const recipients = new Map<number, ReminderRecipient>();
  for (const row of rows) {
    const existing = recipients.get(row.user_id);
    const meter = { id: row.meter_id, label: meterLabel(row) };
    if (existing) {
      existing.meters.push(meter);
      continue;
    }

    recipients.set(row.user_id, {
      userId: row.user_id,
      chatId: String(row.user_chat_id),
      name: row.user_name ?? '',
      surname: row.user_surname ?? '',
      storeId: row.store_id,
      storeLabel: [row.store_code, row.store_city, row.store_address].filter(Boolean).join(' · ') || `Магазин #${row.store_id}`,
      meters: [meter]
    });
  }

  return Array.from(recipients.values());
}

function buildReminderText(recipient: ReminderRecipient, periodMonth: string) {
  const labels = recipient.meters.slice(0, 8).map((meter) => `• ${meter.label}`);
  const remaining = recipient.meters.length - labels.length;
  return [
    `Нагадування про показники лічильників за ${periodMonth.slice(0, 7)}.`,
    `Магазин: ${recipient.storeLabel}`,
    '',
    `Ще не внесено показники (${recipient.meters.length}):`,
    ...labels,
    ...(remaining > 0 ? [`• та ще ${remaining}`] : []),
    '',
    'Будь ласка, внесіть актуальні показники у форму.'
  ].join('\n');
}

export async function runUtilityMeterReadingReminders(input?: { periodMonth?: string }): Promise<UtilityMeterRemindersRunResult> {
  const periodMonth = input?.periodMonth ?? currentPeriodMonth();
  if (!/^\d{4}-\d{2}-01$/.test(periodMonth)) {
    throw new Error('Некоректний період. Очікується YYYY-MM-01.');
  }

  const settings = await getInventoryTelegramSettingsFromDb();
  if (!settings.enabled || !settings.botToken || !settings.webhookSecret) {
    throw new Error('Telegram інтеграцію не налаштовано або вимкнено.');
  }

  await ensureUtilityMeterReminderSchema();
  const recipients = await listRecipientsWithMissingReadings(periodMonth);
  const reminderDate = todayIso();
  const details: UtilityMeterRemindersRunResult['details'] = [];
  let notificationsSent = 0;
  let skippedAlreadySent = 0;
  let failed = 0;

  const baseUrl = settings.publicBaseUrl;
  if (!baseUrl) throw new Error('Не вказано публічну адресу Web App для Telegram інтеграції.');
  const pool = getDbPool();

  for (const recipient of recipients) {
    const [reservation] = await pool.query<ResultSetHeader>(
      `
        INSERT IGNORE INTO utility_meter_reminder_logs
          (recipient_user_id, store_id, period_month, reminder_date, missing_meters_count, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `,
      [recipient.userId, recipient.storeId, periodMonth, reminderDate, recipient.meters.length]
    );
    if (reservation.affectedRows === 0) {
      skippedAlreadySent += 1;
      details.push({ userId: recipient.userId, storeLabel: recipient.storeLabel, missingMeters: recipient.meters.length, status: 'skipped' });
      continue;
    }

    const token = createInventoryRegistrationToken(
      { chatId: recipient.chatId, firstName: recipient.name, lastName: recipient.surname, username: '' },
      settings.webhookSecret
    );
    const formUrl = new URL('/utility-meters', baseUrl);
    formUrl.searchParams.set('token', token);

    try {
      await sendInventoryTelegramMessage({
        botToken: settings.botToken,
        chatId: recipient.chatId,
        text: buildReminderText(recipient, periodMonth),
        buttonText: 'Внести показники',
        buttonUrl: formUrl.toString()
      });
      await pool.query(
        `UPDATE utility_meter_reminder_logs SET status = 'sent', error_message = NULL WHERE recipient_user_id = ? AND period_month = ? AND reminder_date = ?`,
        [recipient.userId, periodMonth, reminderDate]
      );
      notificationsSent += 1;
      details.push({ userId: recipient.userId, storeLabel: recipient.storeLabel, missingMeters: recipient.meters.length, status: 'sent' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Telegram send error';
      await pool.query(
        `UPDATE utility_meter_reminder_logs SET status = 'failed', error_message = ? WHERE recipient_user_id = ? AND period_month = ? AND reminder_date = ?`,
        [message.slice(0, 1000), recipient.userId, periodMonth, reminderDate]
      );
      failed += 1;
      details.push({ userId: recipient.userId, storeLabel: recipient.storeLabel, missingMeters: recipient.meters.length, status: 'failed', error: message });
    }
  }

  return {
    periodMonth,
    candidates: recipients.length,
    missingMeters: recipients.reduce((sum, recipient) => sum + recipient.meters.length, 0),
    notificationsSent,
    skippedAlreadySent,
    failed,
    details
  };
}
