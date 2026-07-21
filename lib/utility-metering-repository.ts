import { randomUUID } from 'crypto';

import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { findStoreByIdInDb } from '@/lib/stores-repository';
import { calculateUtilityCharge } from '@/lib/utility-metering-calculator';
import type {
  UtilityMeterCreateInput,
  UtilityMeterChargeRecord,
  UtilityMeterPointRecord,
  UtilityMeterReadingRecord,
  UtilityMeterReadingHistoryItem,
  UtilityMeterRateInput,
  UtilityMeterRateRecord,
  UtilityMeterReviewItem,
  UtilityMeterUpdateInput,
  UtilityMeterOwnerKind,
  UtilityChargeCalculationMode,
  UtilityType
} from '@/lib/utility-metering-types';

type MeterPointRow = RowDataPacket & {
  id: number;
  store_id: number | null;
  store_code: string | null;
  store_label: string | null;
  address_line: string | null;
  owner_kind: UtilityMeterPointRecord['ownerKind'];
  tenant_name: string | null;
  legal_entity: string | null;
  provider_name: string | null;
  contract_number: string | null;
  utility_type: UtilityType;
  utility_label: string;
  meter_number: string | null;
  coefficient: string | number;
  initial_reading_value: string | number | null;
  default_rate: string | number | null;
  area_sq_m: string | number | null;
  source_key: string;
  is_active: number;
};

type ReadingRow = RowDataPacket & {
  id: number;
  meter_point_id: number;
  period_month: Date | string;
  reading_date: Date | string;
  reading_value: string | number;
  client_mutation_id: string | null;
  previous_reading_id: number | null;
  submitted_by_user_id: number | null;
  submitted_by_name: string | null;
  source_kind: UtilityMeterReadingRecord['sourceKind'];
  status: UtilityMeterReadingRecord['status'];
  created_at: Date | string;
  updated_at: Date | string;
};

type ChargeRow = RowDataPacket & {
  id: number;
  meter_point_id: number;
  reading_id: number;
  period_month: Date | string;
  previous_value: string | number | null;
  current_value: string | number;
  consumption: string | number | null;
  coefficient: string | number;
  rate: string | number | null;
  amount: string | number | null;
  calculation_mode: UtilityChargeCalculationMode;
  fixed_amount: string | number | null;
  invoice_reference: string | null;
  validation_status: UtilityMeterChargeRecord['validationStatus'];
  validation_messages: string | string[] | null;
};

type MeterMappingGroupRow = RowDataPacket & {
  store_id: number | null;
  assigned_store_code: string | null;
  assigned_store_city: string | null;
  assigned_store_address: string | null;
  source_store_code: string | null;
  store_label: string | null;
  address_line: string | null;
  meter_point_ids: string;
  meter_count: number;
  reading_count: number;
};

type RateRow = RowDataPacket & {
  id: number;
  meter_point_id: number | null;
  store_id: number | null;
  utility_type: UtilityType;
  period_month: Date | string;
  rate: string | number;
  rate_label: string | null;
  includes_vat: number;
  calculation_mode: UtilityChargeCalculationMode;
  fixed_amount: string | number | null;
  invoice_reference: string | null;
  meter_number: string | null;
  utility_label: string | null;
  owner_kind: UtilityMeterOwnerKind | null;
  tenant_name: string | null;
  legal_entity: string | null;
  point_store_label: string | null;
  point_address_line: string | null;
  store_code: string | null;
  store_name: string | null;
  store_city: string | null;
  address_line: string | null;
};

export type UtilityMeterMappingGroup = {
  key: string;
  meterPointIds: string[];
  sourceStoreCode: string;
  storeLabel: string;
  addressLine: string;
  meterCount: number;
  readingCount: number;
  assignedStoreId: string;
  assignedStoreLabel: string;
};

const ALLOWED_UTILITY_TYPES = new Set<UtilityType>([
  'electricity_active',
  'electricity_reactive',
  'water',
  'waste',
  'maintenance',
  'rent',
  'other'
]);

const ALLOWED_OWNER_KINDS = new Set<UtilityMeterOwnerKind>(['store', 'tenant', 'shared', 'other']);
let utilityMeteringSchemaPromise: Promise<void> | null = null;

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
function toNumberOrUndefined(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function periodMonthFromDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) throw new Error('Некоректна дата показника.');
  return `${match[1]}-${match[2]}-01`;
}

const NORMALIZED_STORE_CODE_SQL = `
  TRIM(LEADING 'M' FROM REPLACE(REPLACE(REPLACE(UPPER(REPLACE(COALESCE(store_code, ''), 'М', 'M')), ' ', ''), '/', '-'), '№', ''))
`;

const NORMALIZED_POINT_STORE_CODE_SQL = `
  TRIM(LEADING 'M' FROM REPLACE(REPLACE(REPLACE(UPPER(REPLACE(COALESCE(p.store_code, ''), 'М', 'M')), ' ', ''), '/', '-'), '№', ''))
`;

function normalizeStoreCodeForSql(value: string) {
  return value.trim().toUpperCase().replaceAll('М', 'M').replaceAll(' ', '').replaceAll('/', '-').replaceAll('№', '').replace(/^M+/, '');
}

function buildStoreLabelForPoint(input: { storeCode?: string; name?: string; city?: string }) {
  return [input.storeCode, input.name || input.city].filter(Boolean).join(' | ');
}

async function ensureUtilityMeteringSchema() {
  if (!utilityMeteringSchemaPromise) {
    utilityMeteringSchemaPromise = (async () => {
      const pool = getDbPool();
      const [pointColumns] = await pool.query<Array<RowDataPacket & { Field: string }>>(
        "SHOW COLUMNS FROM utility_meter_points LIKE 'initial_reading_value'"
      );
      if (pointColumns.length === 0) {
        await pool.query(
          "ALTER TABLE utility_meter_points ADD COLUMN initial_reading_value DECIMAL(14,4) NULL AFTER coefficient"
        );
      }

      const [rateColumns] = await pool.query<Array<RowDataPacket & { Field: string }>>(
        "SHOW COLUMNS FROM utility_meter_points LIKE 'default_rate'"
      );
      if (rateColumns.length === 0) {
        await pool.query(
          "ALTER TABLE utility_meter_points ADD COLUMN default_rate DECIMAL(18,6) NULL AFTER initial_reading_value"
        );
      }

      const [readingMutationColumns] = await pool.query<Array<RowDataPacket & { Field: string }>>(
        "SHOW COLUMNS FROM utility_meter_readings LIKE 'client_mutation_id'"
      );
      if (readingMutationColumns.length === 0) {
        await pool.query(
          "ALTER TABLE utility_meter_readings ADD COLUMN client_mutation_id VARCHAR(64) NULL AFTER reading_value"
        );
      }

      const [readingMutationIndexes] = await pool.query<Array<RowDataPacket & { Key_name: string }>>(
        "SHOW INDEX FROM utility_meter_readings WHERE Key_name = 'uniq_utility_meter_readings_client_mutation_id'"
      );
      if (readingMutationIndexes.length === 0) {
        await pool.query(
          "ALTER TABLE utility_meter_readings ADD UNIQUE KEY uniq_utility_meter_readings_client_mutation_id (client_mutation_id)"
        );
      }

      const additions: Array<{ table: string; column: string; definition: string }> = [
        { table: 'utility_meter_rates', column: 'calculation_mode', definition: "ENUM('rate','fixed_amount') NOT NULL DEFAULT 'rate' AFTER includes_vat" },
        { table: 'utility_meter_rates', column: 'fixed_amount', definition: 'DECIMAL(18,2) NULL AFTER calculation_mode' },
        { table: 'utility_meter_rates', column: 'invoice_reference', definition: 'VARCHAR(255) NULL AFTER fixed_amount' },
        { table: 'utility_meter_charges', column: 'calculation_mode', definition: "ENUM('rate','fixed_amount') NOT NULL DEFAULT 'rate' AFTER amount" },
        { table: 'utility_meter_charges', column: 'fixed_amount', definition: 'DECIMAL(18,2) NULL AFTER calculation_mode' },
        { table: 'utility_meter_charges', column: 'invoice_reference', definition: 'VARCHAR(255) NULL AFTER fixed_amount' }
      ];
      for (const addition of additions) {
        const [columns] = await pool.query<Array<RowDataPacket & { Field: string }>>(
          `SHOW COLUMNS FROM ${addition.table} LIKE ?`,
          [addition.column]
        );
        if (columns.length === 0) {
          await pool.query(`ALTER TABLE ${addition.table} ADD COLUMN ${addition.column} ${addition.definition}`);
        }
      }
    })().catch((error) => {
      utilityMeteringSchemaPromise = null;
      throw error;
    });
  }

  await utilityMeteringSchemaPromise;
}

function mapMeterPoint(row: MeterPointRow): UtilityMeterPointRecord {
  return {
    id: String(row.id),
    storeId: row.store_id == null ? undefined : String(row.store_id),
    storeCode: row.store_code ?? '',
    storeLabel: row.store_label ?? '',
    addressLine: row.address_line ?? '',
    ownerKind: row.owner_kind,
    tenantName: row.tenant_name ?? '',
    legalEntity: row.legal_entity ?? '',
    providerName: row.provider_name ?? '',
    contractNumber: row.contract_number ?? '',
    utilityType: row.utility_type,
    utilityLabel: row.utility_label,
    meterNumber: row.meter_number ?? '',
    coefficient: Number(row.coefficient ?? 1),
    initialReadingValue: toNumberOrUndefined(row.initial_reading_value),
    defaultRate: toNumberOrUndefined(row.default_rate),
    areaSqM: toNumberOrUndefined(row.area_sq_m),
    sourceKey: row.source_key,
    isActive: row.is_active === 1
  };
}

function mapReading(row?: ReadingRow): UtilityMeterReadingRecord | undefined {
  if (!row) return undefined;
  return {
    id: String(row.id),
    meterPointId: String(row.meter_point_id),
    periodMonth: toIsoDate(row.period_month),
    readingDate: toIsoDate(row.reading_date),
    submittedAt: (row.updated_at ?? row.created_at) ? new Date(row.updated_at ?? row.created_at).toISOString() : '',
    readingValue: Number(row.reading_value),
    clientMutationId: row.client_mutation_id ?? undefined,
    previousReadingId: row.previous_reading_id == null ? undefined : String(row.previous_reading_id),
    submittedByUserId: row.submitted_by_user_id == null ? undefined : String(row.submitted_by_user_id),
    submittedByName: row.submitted_by_name ?? '',
    sourceKind: row.source_kind,
    status: row.status
  };
}

function mapCharge(row?: ChargeRow): UtilityMeterChargeRecord | undefined {
  if (!row) return undefined;
  let validationMessages: string[] = [];
  if (Array.isArray(row.validation_messages)) {
    validationMessages = row.validation_messages.map(String);
  } else if (typeof row.validation_messages === 'string' && row.validation_messages.trim()) {
    try {
      const parsed = JSON.parse(row.validation_messages);
      validationMessages = Array.isArray(parsed) ? parsed.map(String) : [String(row.validation_messages)];
    } catch {
      validationMessages = [row.validation_messages];
    }
  }

  return {
    id: String(row.id),
    meterPointId: String(row.meter_point_id),
    readingId: String(row.reading_id),
    periodMonth: toIsoDate(row.period_month),
    previousValue: toNumberOrUndefined(row.previous_value),
    currentValue: Number(row.current_value),
    consumption: toNumberOrUndefined(row.consumption),
    coefficient: Number(row.coefficient ?? 1),
    rate: toNumberOrUndefined(row.rate),
    calculationMode: row.calculation_mode === 'fixed_amount' ? 'fixed_amount' : 'rate',
    fixedAmount: toNumberOrUndefined(row.fixed_amount),
    invoiceReference: row.invoice_reference ?? '',
    amount: toNumberOrUndefined(row.amount),
    validationStatus: row.validation_status,
    validationMessages
  };
}

function mapUtilityMeterRate(row: RateRow): UtilityMeterRateRecord {
  const meterLabelParts = [row.utility_label ?? '', row.meter_number ?? '', row.tenant_name ?? '']
    .map((part) => String(part).trim())
    .filter(Boolean);
  const meterOwnerParts = [
    row.owner_kind === 'tenant' ? 'Орендар' : row.owner_kind === 'shared' ? 'Спільний' : row.owner_kind === 'other' ? 'Інше' : 'Магазин',
    row.tenant_name ?? '',
    row.legal_entity ?? ''
  ]
    .map((part) => String(part).trim())
    .filter(Boolean);
  const meterLocationParts = [row.point_store_label ?? '', row.point_address_line ?? '']
    .map((part) => String(part).trim())
    .filter(Boolean);
  const storeLabelParts = [row.store_code ?? '', row.store_name ?? row.store_city ?? '', row.address_line ?? '']
    .map((part) => String(part).trim())
    .filter(Boolean);

  return {
    id: String(row.id),
    meterPointId: row.meter_point_id == null ? undefined : String(row.meter_point_id),
    storeId: row.store_id == null ? undefined : String(row.store_id),
    utilityType: row.utility_type,
    periodMonth: toIsoDate(row.period_month),
    rate: Number(row.rate),
    calculationMode: row.calculation_mode === 'fixed_amount' ? 'fixed_amount' : 'rate',
    fixedAmount: toNumberOrUndefined(row.fixed_amount),
    invoiceReference: row.invoice_reference ?? '',
    rateLabel: row.rate_label ?? '',
    includesVat: row.includes_vat === 1,
    meterLabel: meterLabelParts.join(' | '),
    storeLabel: storeLabelParts.join(' | '),
    meterOwnerLabel: meterOwnerParts.join(' | '),
    meterLocationLabel: meterLocationParts.join(' | ')
  };
}

export async function listUtilityMeterMappingGroupsInDb(): Promise<UtilityMeterMappingGroup[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<MeterMappingGroupRow[]>(
    `
      SELECT
        p.store_id,
        s.store_code AS assigned_store_code,
        s.city AS assigned_store_city,
        s.address_line AS assigned_store_address,
        p.store_code AS source_store_code,
        p.store_label,
        p.address_line,
        GROUP_CONCAT(DISTINCT p.id ORDER BY p.id SEPARATOR ',') AS meter_point_ids,
        COUNT(DISTINCT p.id) AS meter_count,
        COUNT(DISTINCT r.id) AS reading_count
      FROM utility_meter_points p
      LEFT JOIN utility_meter_readings r ON r.meter_point_id = p.id
      LEFT JOIN stores s ON s.id = p.store_id
      GROUP BY
        p.store_id,
        s.store_code,
        s.city,
        s.address_line,
        p.store_code,
        p.store_label,
        p.address_line
      ORDER BY
        CASE WHEN p.store_id IS NULL THEN 0 ELSE 1 END ASC,
        p.store_code ASC,
        p.store_label ASC,
        p.address_line ASC
    `
  );

  return rows.map((row, index) => {
    const meterPointIds = String(row.meter_point_ids ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return {
      key: `${row.store_id ?? 'unassigned'}:${meterPointIds.join('-') || index}`,
      meterPointIds,
      sourceStoreCode: row.source_store_code ?? '',
      storeLabel: row.store_label ?? '',
      addressLine: row.address_line ?? '',
      meterCount: Number(row.meter_count ?? 0),
      readingCount: Number(row.reading_count ?? 0),
      assignedStoreId: row.store_id == null ? '' : String(row.store_id),
      assignedStoreLabel: [row.assigned_store_code, row.assigned_store_city, row.assigned_store_address]
        .filter(Boolean)
        .join(' | ')
    };
  });
}

export async function assignUtilityMeterPointsToStoreInDb(input: {
  meterPointIds: Array<string | number>;
  storeId?: string | number | null;
}) {
  const meterPointIds = Array.from(
    new Set(input.meterPointIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))
  );
  if (meterPointIds.length === 0 || meterPointIds.length > 500) {
    throw new Error('Оберіть коректну групу лічильників.');
  }

  const storeId = input.storeId == null || input.storeId === '' ? null : Number(input.storeId);
  if (storeId !== null && (!Number.isInteger(storeId) || storeId <= 0)) {
    throw new Error('Оберіть коректний магазин.');
  }

  const pool = getDbPool();
  if (storeId !== null) {
    const [storeRows] = await pool.query<Array<RowDataPacket & { id: number }>>(
      'SELECT id FROM stores WHERE id = ? AND is_active = 1 LIMIT 1',
      [storeId]
    );
    if (!storeRows[0]) throw new Error('Активний магазин не знайдено.');
  }

  const placeholders = meterPointIds.map(() => '?').join(', ');
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE utility_meter_points SET store_id = ? WHERE id IN (${placeholders})`,
    [storeId, ...meterPointIds]
  );

  if (result.affectedRows !== meterPointIds.length) {
    throw new Error('Частина лічильників не знайдена. Оновіть список і повторіть спробу.');
  }

  return { updated: result.affectedRows, storeId: storeId == null ? '' : String(storeId) };
}

export async function createUtilityMeterPointInDb(input: UtilityMeterCreateInput): Promise<UtilityMeterPointRecord> {
  await ensureUtilityMeteringSchema();
  const storeId = Number(input.storeId);
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw new Error('Некоректний магазин.');
  }

  const utilityType = String(input.utilityType ?? '') as UtilityType;
  if (!ALLOWED_UTILITY_TYPES.has(utilityType)) {
    throw new Error('Оберіть коректний тип лічильника.');
  }

  const utilityLabel = String(input.utilityLabel ?? '').trim();
  if (!utilityLabel) {
    throw new Error('Вкажіть назву лічильника.');
  }

  const ownerKind = String(input.ownerKind ?? 'store') as UtilityMeterOwnerKind;
  if (!ALLOWED_OWNER_KINDS.has(ownerKind)) {
    throw new Error('Оберіть коректний тип власника.');
  }

  const coefficient = input.coefficient == null ? 1 : Number(input.coefficient);
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    throw new Error('Коефіцієнт має бути більшим за 0.');
  }

  const initialReadingValue = input.initialReadingValue == null ? null : Number(input.initialReadingValue);
  if (initialReadingValue !== null && (!Number.isFinite(initialReadingValue) || initialReadingValue < 0)) {
    throw new Error("Початковий показник має бути невід'ємним числом.");
  }

  const defaultRate = input.defaultRate == null ? null : Number(input.defaultRate);
  if (defaultRate !== null && (!Number.isFinite(defaultRate) || defaultRate < 0)) {
    throw new Error("Тариф має бути невід'ємним числом.");
  }

  const areaSqM = input.areaSqM == null ? null : Number(input.areaSqM);
  if (areaSqM !== null && (!Number.isFinite(areaSqM) || areaSqM < 0)) {
    throw new Error('Площа має бути додатним числом.');
  }

  const store = await findStoreByIdInDb(storeId);
  if (!store || !store.isActive) {
    throw new Error('Активний магазин не знайдено.');
  }

  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    `
      INSERT INTO utility_meter_points (
        store_id, store_code, store_label, address_line, owner_kind, tenant_name, legal_entity,
        provider_name, contract_number, utility_type, utility_label, meter_number, coefficient, initial_reading_value,
        default_rate, area_sq_m, source_key, source_file, source_sheet, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1)
    `,
    [
      storeId,
      store.storeCode || null,
      buildStoreLabelForPoint({ storeCode: store.storeCode, name: store.name, city: store.city }) || null,
      store.addressLine || null,
      ownerKind,
      String(input.tenantName ?? '').trim() || null,
      String(input.legalEntity ?? '').trim() || null,
      String(input.providerName ?? '').trim() || null,
      String(input.contractNumber ?? '').trim() || null,
      utilityType,
      utilityLabel,
      String(input.meterNumber ?? '').trim() || null,
      coefficient,
      initialReadingValue,
      defaultRate,
      areaSqM,
      `manual:${storeId}:${randomUUID()}`
    ]
  );

  const [rows] = await pool.query<MeterPointRow[]>(
    `
      SELECT *
      FROM utility_meter_points
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  if (!rows[0]) {
    throw new Error('Не вдалося створити лічильник.');
  }

  return mapMeterPoint(rows[0]);
}

export async function updateUtilityMeterPointInDb(input: UtilityMeterUpdateInput): Promise<UtilityMeterPointRecord> {
  await ensureUtilityMeteringSchema();
  const meterPointId = Number(input.meterPointId);
  const storeId = Number(input.storeId);
  if (!Number.isInteger(meterPointId) || meterPointId <= 0) {
    throw new Error('Некоректний лічильник.');
  }

  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw new Error('Некоректний магазин.');
  }

  const utilityType = String(input.utilityType ?? '') as UtilityType;
  if (!ALLOWED_UTILITY_TYPES.has(utilityType)) {
    throw new Error('Оберіть коректний тип лічильника.');
  }

  const utilityLabel = String(input.utilityLabel ?? '').trim();
  if (!utilityLabel) {
    throw new Error('Вкажіть назву лічильника.');
  }

  const ownerKind = String(input.ownerKind ?? 'store') as UtilityMeterOwnerKind;
  if (!ALLOWED_OWNER_KINDS.has(ownerKind)) {
    throw new Error('Оберіть коректний тип власника.');
  }

  const coefficient = input.coefficient == null ? 1 : Number(input.coefficient);
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    throw new Error('Коефіцієнт має бути більшим за 0.');
  }

  const initialReadingValue = input.initialReadingValue == null ? null : Number(input.initialReadingValue);
  if (initialReadingValue !== null && (!Number.isFinite(initialReadingValue) || initialReadingValue < 0)) {
    throw new Error("Початковий показник має бути невід'ємним числом.");
  }

  const defaultRate = input.defaultRate == null ? null : Number(input.defaultRate);
  if (defaultRate !== null && (!Number.isFinite(defaultRate) || defaultRate < 0)) {
    throw new Error("Тариф має бути невід'ємним числом.");
  }

  const areaSqM = input.areaSqM == null ? null : Number(input.areaSqM);
  if (areaSqM !== null && (!Number.isFinite(areaSqM) || areaSqM < 0)) {
    throw new Error('Площа має бути додатним числом.');
  }

  const store = await findStoreByIdInDb(storeId);
  if (!store || !store.isActive) {
    throw new Error('Активний магазин не знайдено.');
  }

  const pool = getDbPool();
  const [existingRows] = await pool.query<MeterPointRow[]>(
    `
      SELECT *
      FROM utility_meter_points
      WHERE id = ? AND store_id = ?
      LIMIT 1
    `,
    [meterPointId, storeId]
  );
  if (!existingRows[0]) {
    throw new Error('Лічильник не знайдено для цього магазину.');
  }

  await pool.query(
    `
      UPDATE utility_meter_points
      SET
        owner_kind = ?,
        tenant_name = ?,
        legal_entity = ?,
        provider_name = ?,
        contract_number = ?,
        utility_type = ?,
        utility_label = ?,
        meter_number = ?,
        coefficient = ?,
        initial_reading_value = ?,
        default_rate = ?,
        area_sq_m = ?,
        is_active = ?
      WHERE id = ? AND store_id = ?
      LIMIT 1
    `,
    [
      ownerKind,
      String(input.tenantName ?? '').trim() || null,
      String(input.legalEntity ?? '').trim() || null,
      String(input.providerName ?? '').trim() || null,
      String(input.contractNumber ?? '').trim() || null,
      utilityType,
      utilityLabel,
      String(input.meterNumber ?? '').trim() || null,
      coefficient,
      initialReadingValue,
      defaultRate,
      areaSqM,
      input.isActive === false ? 0 : 1,
      meterPointId,
      storeId
    ]
  );

  const [rows] = await pool.query<MeterPointRow[]>(
    `
      SELECT *
      FROM utility_meter_points
      WHERE id = ?
      LIMIT 1
    `,
    [meterPointId]
  );

  if (!rows[0]) {
    throw new Error('Не вдалося оновити лічильник.');
  }

  return mapMeterPoint(rows[0]);
}

export async function setUtilityMeterPointActiveStateInDb(input: {
  meterPointId: string | number;
  storeId: string | number;
  isActive: boolean;
}): Promise<UtilityMeterPointRecord> {
  await ensureUtilityMeteringSchema();
  const meterPointId = Number(input.meterPointId);
  const storeId = Number(input.storeId);
  if (!Number.isInteger(meterPointId) || meterPointId <= 0) {
    throw new Error('Некоректний лічильник.');
  }
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw new Error('Некоректний магазин.');
  }

  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    `
      UPDATE utility_meter_points
      SET is_active = ?
      WHERE id = ? AND store_id = ?
      LIMIT 1
    `,
    [input.isActive ? 1 : 0, meterPointId, storeId]
  );

  if (result.affectedRows === 0) {
    throw new Error('Лічильник не знайдено для цього магазину.');
  }

  const [rows] = await pool.query<MeterPointRow[]>(
    `
      SELECT *
      FROM utility_meter_points
      WHERE id = ?
      LIMIT 1
    `,
    [meterPointId]
  );

  if (!rows[0]) {
    throw new Error('Не вдалося оновити стан лічильника.');
  }

  return mapMeterPoint(rows[0]);
}

export async function listUtilityMetersForStoreInDb(input: {
  storeId: string | number;
  storeCode?: string;
  includeInactive?: boolean;
}): Promise<UtilityMeterPointRecord[]> {
  await ensureUtilityMeteringSchema();
  const normalizedStoreId = Number(input.storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) return [];

  const pool = getDbPool();
  const [rows] = await pool.query<MeterPointRow[]>(
    `
      SELECT *
      FROM utility_meter_points
      WHERE store_id = ?
        ${input.includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY owner_kind ASC, utility_type ASC, tenant_name ASC, id ASC
    `,
    [normalizedStoreId]
  );

  return rows.map(mapMeterPoint);
}

export async function findUtilityMeterPointInDb(input: {
  meterPointId: string | number;
}): Promise<UtilityMeterPointRecord | null> {
  await ensureUtilityMeteringSchema();
  const meterPointId = Number(input.meterPointId);
  if (!Number.isFinite(meterPointId) || meterPointId <= 0) return null;

  const pool = getDbPool();
  const [rows] = await pool.query<MeterPointRow[]>(
    `
      SELECT *
      FROM utility_meter_points
      WHERE id = ?
      LIMIT 1
    `,
    [meterPointId]
  );

  return rows[0] ? mapMeterPoint(rows[0]) : null;
}

export async function listUtilityMeterRatesInDb(input?: {
  periodMonth?: string;
  storeId?: string | number | null;
  meterPointId?: string | number | null;
}): Promise<UtilityMeterRateRecord[]> {
  await ensureUtilityMeteringSchema();
  const pool = getDbPool();
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (input?.periodMonth) {
    conditions.push('r.period_month = ?');
    params.push(input.periodMonth);
  }
  if (input?.storeId) {
    conditions.push('(r.store_id = ? OR p.store_id = ?)');
    params.push(Number(input.storeId), Number(input.storeId));
  }
  if (input?.meterPointId) {
    conditions.push('r.meter_point_id = ?');
    params.push(Number(input.meterPointId));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query<RateRow[]>(
    `
      SELECT
        r.*,
        p.meter_number,
        p.utility_label,
        p.owner_kind,
        p.tenant_name,
        p.legal_entity,
        p.store_label AS point_store_label,
        p.address_line AS point_address_line,
        s.store_code,
        s.name AS store_name,
        s.city AS store_city,
        s.address_line
      FROM utility_meter_rates r
      LEFT JOIN utility_meter_points p ON p.id = r.meter_point_id
      LEFT JOIN stores s ON s.id = COALESCE(r.store_id, p.store_id)
      ${whereClause}
      ORDER BY r.period_month DESC, s.store_code ASC, r.utility_type ASC, r.meter_point_id ASC, r.id DESC
    `,
    params
  );

  return rows.map(mapUtilityMeterRate);
}

async function recalculateUtilityChargesForRateScopeInDb(input: {
  periodMonth: string;
  utilityType: UtilityType;
  storeId?: number | null;
  meterPointId?: number | null;
}) {
  const pool = getDbPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const conditions = ['p.utility_type = ?', 'r.period_month >= ?'];
    const params: Array<string | number> = [input.utilityType, input.periodMonth];

    if (input.meterPointId != null) {
      conditions.push('p.id = ?');
      params.push(input.meterPointId);
    } else if (input.storeId != null) {
      conditions.push('p.store_id = ?');
      params.push(input.storeId);
    }

    const [rows] = await conn.query<Array<MeterPointRow & { reading_id: number }>>(
      `
        SELECT
          p.*,
          r.id AS reading_id
        FROM utility_meter_readings r
        INNER JOIN utility_meter_points p ON p.id = r.meter_point_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.id ASC, r.reading_date ASC, r.id ASC
      `,
      params
    );

    for (const row of rows) {
      const point = mapMeterPoint(row);
      const pointStoreId = Number(point.storeId ?? input.storeId ?? 0);
      if (!Number.isInteger(pointStoreId) || pointStoreId <= 0) continue;

      await calculateAndSaveUtilityChargeForReadingInDb(conn, {
        point,
        storeId: pointStoreId,
        readingId: Number(row.reading_id)
      });
    }

    await conn.commit();
    return { recalculated: rows.length };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function upsertUtilityMeterRateInDb(input: UtilityMeterRateInput): Promise<UtilityMeterRateRecord> {
  await ensureUtilityMeteringSchema();
  let utilityType = String(input.utilityType ?? '') as UtilityType;
  if (!ALLOWED_UTILITY_TYPES.has(utilityType)) {
    throw new Error('Оберіть коректний тип комунальної послуги.');
  }

  const periodMonth = String(input.periodMonth ?? '').trim();
  if (!/^\d{4}-\d{2}-01$/.test(periodMonth)) {
    throw new Error('Оберіть коректний місяць тарифу.');
  }

  const calculationMode: UtilityChargeCalculationMode = input.calculationMode === 'fixed_amount' ? 'fixed_amount' : 'rate';
  const rate = Number(input.rate);
  const fixedAmount = input.fixedAmount == null ? null : Number(input.fixedAmount);
  if (calculationMode === 'rate' && (!Number.isFinite(rate) || rate < 0)) {
    throw new Error('Тариф має бути невід’ємним числом.');
  }
  if (calculationMode === 'fixed_amount' && (fixedAmount == null || !Number.isFinite(fixedAmount) || fixedAmount < 0)) {
    throw new Error('Вкажіть коректну суму з рахунку.');
  }

  const meterPointId =
    input.meterPointId == null || input.meterPointId === '' ? null : Number(input.meterPointId);
  const storeId = input.storeId == null || input.storeId === '' ? null : Number(input.storeId);
  if (meterPointId === null && storeId === null) {
    throw new Error('Оберіть магазин або конкретний лічильник.');
  }
  if (meterPointId !== null && (!Number.isInteger(meterPointId) || meterPointId <= 0)) {
    throw new Error('Оберіть коректний лічильник.');
  }
  if (calculationMode === 'fixed_amount' && meterPointId === null) {
    throw new Error('Суму з рахунку можна вказати лише для конкретного лічильника.');
  }
  if (storeId !== null && (!Number.isInteger(storeId) || storeId <= 0)) {
    throw new Error('Оберіть коректний магазин.');
  }

  const pool = getDbPool();
  let effectiveStoreId = storeId;
  if (meterPointId !== null) {
    const [meterRows] = await pool.query<MeterPointRow[]>(
      `
        SELECT *
        FROM utility_meter_points
        WHERE id = ?
        LIMIT 1
      `,
      [meterPointId]
    );
    const meter = meterRows[0] ? mapMeterPoint(meterRows[0]) : null;
    if (!meter) {
      throw new Error('Лічильник не знайдено.');
    }
    utilityType = meter.utilityType;
    if (!effectiveStoreId && meter.storeId) {
      effectiveStoreId = Number(meter.storeId);
    }
  }

  if (effectiveStoreId !== null) {
    const store = await findStoreByIdInDb(effectiveStoreId);
    if (!store) {
      throw new Error('Магазин не знайдено.');
    }
  }

  const rateLabel = String(input.rateLabel ?? '').trim() || null;
  const invoiceReference = String(input.invoiceReference ?? '').trim() || null;
  const includesVat = input.includesVat === false ? 0 : 1;

  if (input.rateId) {
    const rateId = Number(input.rateId);
    if (!Number.isInteger(rateId) || rateId <= 0) {
      throw new Error('Некоректний тариф.');
    }

    await pool.query(
      `
        UPDATE utility_meter_rates
        SET
          meter_point_id = ?,
          store_id = ?,
          utility_type = ?,
          period_month = ?,
          rate = ?,
          rate_label = ?,
          includes_vat = ?,
          calculation_mode = ?,
          fixed_amount = ?,
          invoice_reference = ?
        WHERE id = ?
        LIMIT 1
      `,
      [meterPointId, effectiveStoreId, utilityType, periodMonth, calculationMode === 'rate' ? rate : 0, rateLabel, includesVat, calculationMode, fixedAmount, invoiceReference, rateId]
    );

    const [rows] = await pool.query<RateRow[]>(
      `
        SELECT
          r.*,
          p.meter_number,
          p.utility_label,
          p.owner_kind,
          p.tenant_name,
          p.legal_entity,
          p.store_label AS point_store_label,
          p.address_line AS point_address_line,
          s.store_code,
          s.name AS store_name,
          s.city AS store_city,
          s.address_line
        FROM utility_meter_rates r
        LEFT JOIN utility_meter_points p ON p.id = r.meter_point_id
        LEFT JOIN stores s ON s.id = COALESCE(r.store_id, p.store_id)
        WHERE r.id = ?
        LIMIT 1
      `,
      [rateId]
    );
    if (!rows[0]) throw new Error('Не вдалося оновити тариф.');
    await recalculateUtilityChargesForRateScopeInDb({
      periodMonth,
      utilityType,
      storeId: effectiveStoreId,
      meterPointId
    });
    return mapUtilityMeterRate(rows[0]);
  }

  await pool.query(
    `
      INSERT INTO utility_meter_rates (
        meter_point_id, store_id, utility_type, period_month, rate, rate_label, includes_vat, calculation_mode, fixed_amount, invoice_reference
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rate = VALUES(rate),
        rate_label = VALUES(rate_label),
        includes_vat = VALUES(includes_vat),
        calculation_mode = VALUES(calculation_mode),
        fixed_amount = VALUES(fixed_amount),
        invoice_reference = VALUES(invoice_reference)
    `,
    [meterPointId, effectiveStoreId, utilityType, periodMonth, calculationMode === 'rate' ? rate : 0, rateLabel, includesVat, calculationMode, fixedAmount, invoiceReference]
  );

  const [rows] = await pool.query<RateRow[]>(
    `
      SELECT
        r.*,
        p.meter_number,
        p.utility_label,
        p.owner_kind,
        p.tenant_name,
        p.legal_entity,
        p.store_label AS point_store_label,
        p.address_line AS point_address_line,
        s.store_code,
        s.name AS store_name,
        s.city AS store_city,
        s.address_line
      FROM utility_meter_rates r
      LEFT JOIN utility_meter_points p ON p.id = r.meter_point_id
      LEFT JOIN stores s ON s.id = COALESCE(r.store_id, p.store_id)
      WHERE ((r.meter_point_id <=> ?) AND (r.store_id <=> ?) AND r.utility_type = ? AND r.period_month = ?)
      LIMIT 1
    `,
    [meterPointId, effectiveStoreId, utilityType, periodMonth]
  );
  if (!rows[0]) throw new Error('Не вдалося зберегти тариф.');
  await recalculateUtilityChargesForRateScopeInDb({
    periodMonth,
    utilityType,
    storeId: effectiveStoreId,
    meterPointId
  });
  return mapUtilityMeterRate(rows[0]);
}

export async function deleteUtilityMeterRateInDb(input: { rateId: string | number }) {
  await ensureUtilityMeteringSchema();
  const rateId = Number(input.rateId);
  if (!Number.isInteger(rateId) || rateId <= 0) {
    throw new Error('Некоректний тариф.');
  }

  const pool = getDbPool();
  const [existingRows] = await pool.query<RateRow[]>(
    `
      SELECT *
      FROM utility_meter_rates
      WHERE id = ?
      LIMIT 1
    `,
    [rateId]
  );
  const existingRate = existingRows[0];
  if (!existingRate) {
    throw new Error('Тариф не знайдено.');
  }

  const [result] = await pool.query<ResultSetHeader>(
    `
      DELETE FROM utility_meter_rates
      WHERE id = ?
      LIMIT 1
    `,
    [rateId]
  );

  if (result.affectedRows === 0) {
    throw new Error('Тариф не знайдено.');
  }

  await recalculateUtilityChargesForRateScopeInDb({
    periodMonth: toIsoDate(existingRate.period_month),
    utilityType: existingRate.utility_type,
    storeId: existingRate.store_id,
    meterPointId: existingRate.meter_point_id
  });

  return { deleted: true };
}
export async function listUtilityMeterReviewInDb(input: {
  periodMonth: string;
  storeId?: string | number | null;
  storeCode?: string | null;
}): Promise<UtilityMeterReviewItem[]> {
  await ensureUtilityMeteringSchema();
  const pool = getDbPool();
  const params: Array<string | number> = [input.periodMonth];
  const normalizedStoreCode = String(input.storeCode ?? '').trim();
  const comparableStoreCode = normalizeStoreCodeForSql(normalizedStoreCode);
  const storeFilters: string[] = [];
  if (input.storeId) {
    storeFilters.push('p.store_id = ?');
    params.push(Number(input.storeId));
  } else if (normalizedStoreCode) {
    storeFilters.push('p.store_code = ?');
    params.push(normalizedStoreCode);
    if (comparableStoreCode) {
      storeFilters.push(`${NORMALIZED_POINT_STORE_CODE_SQL} = ?`);
      params.push(comparableStoreCode);
    }
  }
  const storeFilter = storeFilters.length > 0 ? `AND (${storeFilters.join(' OR ')})` : '';

  const [rows] = await pool.query<Array<MeterPointRow & ReadingRow & ChargeRow & {
    point_id: number;
    reading_id: number | null;
    charge_id: number | null;
    reading_meter_point_id: number | null;
    charge_meter_point_id: number | null;
  }>>(
    `
      SELECT
        p.*,
        p.id AS point_id,
        r.id AS reading_id,
        r.meter_point_id AS reading_meter_point_id,
        r.period_month AS reading_period_month,
        r.reading_date,
        r.reading_value,
        r.previous_reading_id,
        r.submitted_by_user_id,
        r.submitted_by_name,
        r.source_kind,
        r.status,
        r.created_at,
        r.updated_at,
        c.id AS charge_id,
        c.meter_point_id AS charge_meter_point_id,
        c.period_month AS charge_period_month,
        c.previous_value,
        c.current_value,
        c.consumption,
        c.coefficient AS charge_coefficient,
        c.rate,
        c.amount,
        c.calculation_mode,
        c.fixed_amount,
        c.invoice_reference,
        c.validation_status,
        c.validation_messages
      FROM utility_meter_points p
      LEFT JOIN utility_meter_readings r
        ON r.meter_point_id = p.id AND r.period_month = ?
      LEFT JOIN utility_meter_charges c
        ON c.reading_id = r.id
      WHERE p.is_active = 1
        ${storeFilter}
      ORDER BY p.store_code ASC, p.owner_kind ASC, p.utility_type ASC, p.tenant_name ASC, p.id ASC
    `,
    params
  );

  return rows.map((row) => {
    const point = mapMeterPoint({ ...row, id: row.point_id });
    const reading = row.reading_id
      ? mapReading({
          ...row,
          id: row.reading_id,
          meter_point_id: Number(row.reading_meter_point_id),
          period_month: row.reading_period_month
        } as ReadingRow)
      : undefined;
    const charge = row.charge_id
      ? mapCharge({
          ...row,
          id: row.charge_id,
          meter_point_id: Number(row.charge_meter_point_id),
          reading_id: Number(row.reading_id),
          period_month: row.charge_period_month,
          coefficient: row.charge_coefficient
        } as ChargeRow)
      : undefined;
    return { ...point, reading, charge };
  });
}

export async function listUtilityMeterReadingHistoryByMeterIdsInDb(input: {
  meterPointIds: Array<string | number>;
  limitPerMeter?: number;
}): Promise<Record<string, UtilityMeterReadingHistoryItem[]>> {
  const meterPointIds = input.meterPointIds
    .map((value) => Number(value))
    .filter((value, index, list) => Number.isFinite(value) && value > 0 && list.indexOf(value) === index);

  if (meterPointIds.length === 0) {
    return {};
  }

  const limitPerMeter = Number.isFinite(Number(input.limitPerMeter))
    ? Math.max(1, Math.min(24, Number(input.limitPerMeter)))
    : 12;

  const placeholders = meterPointIds.map(() => '?').join(', ');
  const pool = getDbPool();
  const [rows] = await pool.query<
    Array<
      RowDataPacket & {
        id: number;
        meter_point_id: number;
        reading_period_month: Date | string;
        reading_date: Date | string;
        reading_value: string | number;
        previous_reading_id: number | null;
        submitted_by_user_id: number | null;
        submitted_by_name: string | null;
        source_kind: UtilityMeterReadingRecord['sourceKind'];
        status: UtilityMeterReadingRecord['status'];
        charge_id: number | null;
        charge_meter_point_id: number | null;
        reading_id: number | null;
        charge_period_month: Date | string | null;
        previous_value: string | number | null;
        current_value: string | number | null;
        consumption: string | number | null;
        charge_coefficient: string | number | null;
        rate: string | number | null;
        amount: string | number | null;
        validation_status: UtilityMeterChargeRecord['validationStatus'] | null;
        validation_messages: string | string[] | null;
      } & {
        client_mutation_id: string | null;
      }
    >
  >(
    `
      SELECT
        r.id,
        r.meter_point_id,
        r.period_month AS reading_period_month,
        r.reading_date,
        r.reading_value,
        r.client_mutation_id,
        r.previous_reading_id,
        r.submitted_by_user_id,
        r.submitted_by_name,
        r.source_kind,
        r.status,
        r.created_at,
        r.updated_at,
        c.id AS charge_id,
        c.meter_point_id AS charge_meter_point_id,
        c.reading_id,
        c.period_month AS charge_period_month,
        c.previous_value,
        c.current_value,
        c.consumption,
        c.coefficient AS charge_coefficient,
        c.rate,
        c.amount,
        c.calculation_mode,
        c.fixed_amount,
        c.invoice_reference,
        c.validation_status,
        c.validation_messages
      FROM utility_meter_readings r
      LEFT JOIN utility_meter_charges c ON c.reading_id = r.id
      WHERE r.meter_point_id IN (${placeholders})
      ORDER BY meter_point_id ASC, reading_date DESC, id DESC
    `,
    meterPointIds
  );

  const historyByMeterId: Record<string, UtilityMeterReadingHistoryItem[]> = {};
  const countsByMeterId: Record<string, number> = {};

  for (const row of rows) {
    const meterPointId = String(row.meter_point_id);
    const currentCount = countsByMeterId[meterPointId] ?? 0;
    if (currentCount >= limitPerMeter) {
      continue;
    }
    countsByMeterId[meterPointId] = currentCount + 1;
    historyByMeterId[meterPointId] ??= [];
    historyByMeterId[meterPointId].push({
      reading: mapReading({
        ...(row as unknown as ReadingRow),
        period_month: row.reading_period_month
      })!,
      charge: row.charge_id
        ? mapCharge({
            ...(row as unknown as ChargeRow),
            id: row.charge_id,
            meter_point_id: row.charge_meter_point_id ?? row.meter_point_id,
            reading_id: row.reading_id ?? row.id,
            period_month: row.charge_period_month ?? row.reading_period_month,
            coefficient: row.charge_coefficient ?? 1
          })
        : undefined
    });
  }

  return historyByMeterId;
}

async function calculateAndSaveUtilityChargeForReadingInDb(
  conn: PoolConnection,
  input: {
    point: UtilityMeterPointRecord;
    storeId: number;
    readingId: number;
    baselineValue?: number | null;
  }
) {
  const [readingRows] = await conn.query<ReadingRow[]>(
    `
      SELECT *
      FROM utility_meter_readings
      WHERE id = ?
      LIMIT 1
    `,
    [input.readingId]
  );
  const reading = readingRows[0];
  if (!reading) {
    throw new Error('Не знайдено показник для перерахунку.');
  }

  const [existingChargeRows] = await conn.query<ChargeRow[]>(
    `
      SELECT previous_value
      FROM utility_meter_charges
      WHERE reading_id = ?
      LIMIT 1
    `,
    [reading.id]
  );
  const savedPreviousValue = toNumberOrUndefined(existingChargeRows[0]?.previous_value);

  const readingDate = toIsoDate(reading.reading_date);
  const [previousRows] = await conn.query<ReadingRow[]>(
    `
      SELECT *
      FROM utility_meter_readings
      WHERE meter_point_id = ?
        AND (
          reading_date < ?
          OR (reading_date = ? AND id < ?)
        )
      ORDER BY reading_date DESC, id DESC
      LIMIT 1
    `,
    [reading.meter_point_id, readingDate, readingDate, reading.id]
  );
  const previous = previousRows[0];

  const [rateRows] = await conn.query<Array<RowDataPacket & {
    rate: string | number;
    calculation_mode: UtilityChargeCalculationMode;
    fixed_amount: string | number | null;
    invoice_reference: string | null;
  }>>(
    `
      SELECT rate, calculation_mode, fixed_amount, invoice_reference
      FROM utility_meter_rates
      WHERE period_month <= ?
        AND utility_type = ?
        AND (meter_point_id = ? OR (meter_point_id IS NULL AND (store_id = ? OR store_id IS NULL)))
      ORDER BY period_month DESC, meter_point_id DESC, store_id DESC
      LIMIT 1
    `,
    [toIsoDate(reading.period_month), input.point.utilityType, input.point.id, input.storeId]
  );

  const [recentRows] = await conn.query<Array<RowDataPacket & { consumption: string | number | null }>>(
    `
      SELECT c.consumption
      FROM utility_meter_charges c
      WHERE c.meter_point_id = ?
        AND c.reading_id <> ?
        AND c.consumption IS NOT NULL
      ORDER BY c.period_month DESC
      LIMIT 3
    `,
    [reading.meter_point_id, reading.id]
  );

  const calculation = calculateUtilityCharge({
    utilityType: input.point.utilityType,
    previousValue:
      input.baselineValue ??
      savedPreviousValue ??
      (previous?.reading_value != null ? Number(previous.reading_value) : input.point.initialReadingValue ?? 0),
    currentValue: Number(reading.reading_value),
    coefficient: input.point.coefficient,
    rate: rateRows[0] ? Number(rateRows[0].rate) : input.point.defaultRate,
    calculationMode: rateRows[0]?.calculation_mode,
    fixedAmount: rateRows[0]?.fixed_amount == null ? undefined : Number(rateRows[0].fixed_amount),
    recentConsumptions: recentRows.map((row) => Number(row.consumption)).filter(Number.isFinite),
    periodMonth: toIsoDate(reading.period_month)
  });

  await conn.query(
    `
      UPDATE utility_meter_readings
      SET previous_reading_id = ?
      WHERE id = ?
    `,
    [previous?.id ?? null, reading.id]
  );

  await conn.query(
    `
      INSERT INTO utility_meter_charges (
        meter_point_id, reading_id, period_month, previous_value, current_value,
        consumption, coefficient, rate, amount, calculation_mode, fixed_amount, invoice_reference, validation_status, validation_messages
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE
        previous_value = VALUES(previous_value),
        current_value = VALUES(current_value),
        consumption = VALUES(consumption),
        coefficient = VALUES(coefficient),
        rate = VALUES(rate),
        amount = VALUES(amount),
        calculation_mode = VALUES(calculation_mode),
        fixed_amount = VALUES(fixed_amount),
        invoice_reference = VALUES(invoice_reference),
        validation_status = VALUES(validation_status),
        validation_messages = VALUES(validation_messages)
    `,
    [
      reading.meter_point_id,
      reading.id,
      toIsoDate(reading.period_month),
      calculation.previousValue ?? null,
      calculation.currentValue,
      calculation.consumption ?? null,
      calculation.coefficient,
      calculation.rate ?? null,
      calculation.amount ?? null,
      calculation.calculationMode,
      calculation.fixedAmount ?? null,
      rateRows[0]?.invoice_reference ?? null,
      calculation.validationStatus,
      JSON.stringify(calculation.validationMessages)
    ]
  );

  return calculation;
}

export async function createUtilityMeterReadingInDb(input: {
  meterPointId: string | number;
  storeId: string | number;
  storeCode?: string;
  readingDate: string;
  readingValue: number;
  clientMutationId?: string;
  previousValueOverride?: number | null;
  submittedByUserId?: string | number | null;
  submittedByName?: string;
  notes?: string;
}) {
  const meterPointId = Number(input.meterPointId);
  const storeId = Number(input.storeId);
  if (!Number.isFinite(meterPointId) || meterPointId <= 0) throw new Error('Некоректний лічильник.');
  if (!Number.isFinite(storeId) || storeId <= 0) throw new Error('Некоректний магазин.');
  if (!Number.isFinite(Number(input.readingValue))) throw new Error('Показник має бути числом.');

  const clientMutationId = String(input.clientMutationId ?? '').trim();
  if (clientMutationId && clientMutationId.length > 64) {
    throw new Error('Некоректний ідентифікатор локального запису.');
  }

  const previousValueOverride =
    input.previousValueOverride == null ? undefined : Number(input.previousValueOverride);
  if (previousValueOverride !== undefined && (!Number.isFinite(previousValueOverride) || previousValueOverride < 0)) {
    throw new Error("Початковий або попередній показник має бути невід'ємним числом.");
  }

  const periodMonth = periodMonthFromDate(input.readingDate);
  await ensureUtilityMeteringSchema();
  const pool = getDbPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    {
      const [pointRowsFresh] = await conn.query<MeterPointRow[]>(
        `
          SELECT *
          FROM utility_meter_points
          WHERE id = ?
            AND is_active = 1
            AND store_id = ?
          LIMIT 1
        `,
        [meterPointId, storeId]
      );
      const pointFresh = pointRowsFresh[0] ? mapMeterPoint(pointRowsFresh[0]) : null;
      if (!pointFresh) throw new Error('Лічильник не знайдено для цього магазину.');

      if (clientMutationId) {
        const [existingRows] = await conn.query<ReadingRow[]>(
          `
            SELECT *
            FROM utility_meter_readings
            WHERE client_mutation_id = ?
            LIMIT 1
          `,
          [clientMutationId]
        );
        const existingReading = existingRows[0];
        if (existingReading) {
          const calculationExisting = await calculateAndSaveUtilityChargeForReadingInDb(conn, {
            point: pointFresh,
            storeId,
            readingId: existingReading.id,
            baselineValue: previousValueOverride
          });

          await conn.commit();
          return { periodMonth: toIsoDate(existingReading.period_month), calculation: calculationExisting };
        }
      }

      const [readingResultFresh] = await conn.query<ResultSetHeader>(
        `
          INSERT INTO utility_meter_readings (
            meter_point_id, period_month, reading_date, reading_value, client_mutation_id, previous_reading_id,
            submitted_by_user_id, submitted_by_name, source_kind, notes, status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, 'submitted')
          ON DUPLICATE KEY UPDATE
            reading_date = VALUES(reading_date),
            reading_value = VALUES(reading_value),
            client_mutation_id = COALESCE(utility_meter_readings.client_mutation_id, VALUES(client_mutation_id)),
            previous_reading_id = VALUES(previous_reading_id),
            submitted_by_user_id = VALUES(submitted_by_user_id),
            submitted_by_name = VALUES(submitted_by_name),
            notes = VALUES(notes),
            status = 'submitted'
        `,
        [
          meterPointId,
          periodMonth,
          input.readingDate,
          Number(input.readingValue),
          clientMutationId || null,
          null,
          input.submittedByUserId ? Number(input.submittedByUserId) : null,
          input.submittedByName ?? null,
          input.notes ?? null
        ]
      );

      const readingIdFresh =
        readingResultFresh.insertId ||
        (
          await conn.query<Array<RowDataPacket & { id: number }>>(
            'SELECT id FROM utility_meter_readings WHERE meter_point_id = ? AND period_month = ? LIMIT 1',
            [meterPointId, periodMonth]
          )
        )[0][0]?.id;

      const calculationFresh = await calculateAndSaveUtilityChargeForReadingInDb(conn, {
        point: pointFresh,
        storeId,
        readingId: readingIdFresh,
        baselineValue: previousValueOverride
      });

      const [nextRowsFresh] = await conn.query<Array<RowDataPacket & { id: number }>>(
        `
          SELECT id
          FROM utility_meter_readings
          WHERE meter_point_id = ?
            AND (
              reading_date > ?
              OR (reading_date = ? AND id > ?)
            )
          ORDER BY reading_date ASC, id ASC
          LIMIT 1
        `,
        [meterPointId, input.readingDate, input.readingDate, readingIdFresh]
      );

      if (nextRowsFresh[0]?.id) {
        await calculateAndSaveUtilityChargeForReadingInDb(conn, {
          point: pointFresh,
          storeId,
          readingId: nextRowsFresh[0].id
        });
      }

      await conn.commit();
      return { periodMonth, calculation: calculationFresh };
    }
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
