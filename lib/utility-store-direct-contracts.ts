import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

export type UtilityElectricitySupplier = 'yasno' | 'tolk';

export type UtilityStoreDirectContract = {
  storeId: string;
  legalEntity: string;
  electricitySupplier?: UtilityElectricitySupplier;
  isDirectContract: boolean;
};

type StoreRow = RowDataPacket & { id: number; store_code: string | null };
type ContractRow = RowDataPacket & {
  store_id: number;
  legal_entity: string;
  electricity_supplier: UtilityElectricitySupplier | null;
  is_direct_contract: number;
};

const DIRECT_CONTRACT_SEEDS: Array<{
  storeCode: string;
  legalEntity: string;
  electricitySupplier?: UtilityElectricitySupplier;
}> = [
  ...['M5', 'M6', 'M10', 'M15', 'M22', 'M20', 'M37', 'M12'].map((storeCode) => ({
    storeCode,
    legalEntity: 'Легіон 2015',
    electricitySupplier: 'yasno' as const
  })),
  ...['M8', 'M21', 'M43', 'M25'].map((storeCode) => ({
    storeCode,
    legalEntity: 'Легіон 2015',
    electricitySupplier: 'tolk' as const
  })),
  { storeCode: 'M1/1', legalEntity: 'Легіон 2015' },
  { storeCode: 'РЦ', legalEntity: 'СБМ', electricitySupplier: 'tolk' },
  ...['M24/1', 'M17/1', 'M40', 'M41', 'M38', 'M31'].map((storeCode) => ({
    storeCode,
    legalEntity: 'Рідогруп',
    electricitySupplier: 'tolk' as const
  })),
  ...['M9/1', 'M11/1', 'M26'].map((storeCode) => ({
    storeCode,
    legalEntity: 'Рідогруп',
    electricitySupplier: 'yasno' as const
  })),
  { storeCode: 'БТК', legalEntity: 'БТК' }
];

let schemaPromise: Promise<void> | null = null;

function normalizeStoreCode(value: string) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replaceAll('М', 'M')
    .replaceAll(' ', '')
    .replaceAll('№', '');

  if (!normalized || normalized === 'РЦ' || normalized === 'БТК' || normalized === 'BTK') return normalized;
  return normalized.startsWith('M') ? normalized : `M${normalized}`;
}

export function getElectricitySupplierLabel(supplier?: UtilityElectricitySupplier) {
  if (supplier === 'yasno') return 'Ясно';
  if (supplier === 'tolk') return 'Толк';
  return '';
}

export function getElectricitySupplierColor(supplier?: UtilityElectricitySupplier) {
  if (supplier === 'yasno') return 'amber';
  if (supplier === 'tolk') return 'indigo';
  return 'slate';
}

export async function ensureUtilityStoreDirectContractsSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = getDbPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS utility_store_direct_contracts (
          store_id BIGINT UNSIGNED NOT NULL,
          legal_entity VARCHAR(255) NOT NULL,
          electricity_supplier ENUM('yasno','tolk') NULL,
          is_direct_contract TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (store_id),
          CONSTRAINT fk_utility_store_direct_contracts_store
            FOREIGN KEY (store_id) REFERENCES stores(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      const [stores] = await pool.query<StoreRow[]>('SELECT id, store_code FROM stores');
      const storesByCode = new Map(stores.map((store) => [normalizeStoreCode(store.store_code ?? ''), store.id]));

      for (const seed of DIRECT_CONTRACT_SEEDS) {
        const storeId = storesByCode.get(normalizeStoreCode(seed.storeCode));
        if (!storeId) continue;
        await pool.query(
          `
            INSERT INTO utility_store_direct_contracts (store_id, legal_entity, electricity_supplier, is_direct_contract)
            VALUES (?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE store_id = store_id
          `,
          [storeId, seed.legalEntity, seed.electricitySupplier ?? null]
        );
      }
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  await schemaPromise;
}

export async function listUtilityStoreDirectContractsByStoreIds(storeIds: Array<string | number>) {
  await ensureUtilityStoreDirectContractsSchema();
  const ids = Array.from(new Set(storeIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
  if (ids.length === 0) return new Map<string, UtilityStoreDirectContract>();

  const pool = getDbPool();
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await pool.query<ContractRow[]>(
    `
      SELECT store_id, legal_entity, electricity_supplier, is_direct_contract
      FROM utility_store_direct_contracts
      WHERE store_id IN (${placeholders})
    `,
    ids
  );

  return new Map(
    rows.map((row) => [
      String(row.store_id),
      {
        storeId: String(row.store_id),
        legalEntity: row.legal_entity,
        electricitySupplier: row.electricity_supplier ?? undefined,
        isDirectContract: row.is_direct_contract === 1
      } satisfies UtilityStoreDirectContract
    ])
  );
}
