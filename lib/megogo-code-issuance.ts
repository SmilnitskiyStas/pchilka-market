import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

export type MegogoClaimRequest = {
  campaignKey: string;
  loyaltyCode: string;
  checkTotal: number;
  orderCode: string;
  storeCode: string;
  workplaceId: string;
  ruleCode: number;
};

type IssuedCodeRow = RowDataPacket & {
  id: number;
  code_value: string;
};

function issueKey(input: MegogoClaimRequest): string {
  return [input.storeCode, input.workplaceId, input.orderCode, input.loyaltyCode].join(':');
}

export async function claimMegogoCode(input: MegogoClaimRequest): Promise<string | null> {
  const pool = getDbPool();
  const connection = await pool.getConnection();
  const key = issueKey(input);

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query<IssuedCodeRow[]>(
      `
        SELECT id, code_value
        FROM megogo_code_issuance
        WHERE campaign_key = ? AND issue_key = ? AND status = 'issued'
        LIMIT 1
        FOR UPDATE
      `,
      [input.campaignKey, key]
    );

    if (existingRows[0]?.code_value) {
      await connection.query('UPDATE megogo_code_issuance SET last_presented_at = CURRENT_TIMESTAMP WHERE id = ?', [existingRows[0].id]);
      await connection.commit();
      return existingRows[0].code_value;
    }

    // A retry for the same check gets the same code above. A new check from an
    // already rewarded loyalty participant must receive the same code again.
    const [previousRecipientRows] = await connection.query<IssuedCodeRow[]>(
      `
        SELECT id, code_value
        FROM megogo_code_issuance
        WHERE campaign_key = ?
          AND issued_loyalty_code = ?
          AND status = 'issued'
        LIMIT 1
        FOR UPDATE
      `,
      [input.campaignKey, input.loyaltyCode]
    );

    if (previousRecipientRows[0]?.code_value) {
      await connection.query('UPDATE megogo_code_issuance SET last_presented_at = CURRENT_TIMESTAMP WHERE id = ?', [previousRecipientRows[0].id]);
      await connection.commit();
      return previousRecipientRows[0].code_value;
    }

    const [availableRows] = await connection.query<(RowDataPacket & { id: number; code_value: string })[]>(
      `
        SELECT id, code_value
        FROM megogo_code_issuance
        WHERE campaign_key = ? AND status = 'available'
        ORDER BY id
        LIMIT 1
        FOR UPDATE
      `,
      [input.campaignKey]
    );

    const availableCode = availableRows[0];
    if (!availableCode) {
      await connection.commit();
      return null;
    }

    await connection.query(
      `
        UPDATE megogo_code_issuance
        SET status = 'issued',
            issued_at = CURRENT_TIMESTAMP,
            last_presented_at = CURRENT_TIMESTAMP,
            issued_loyalty_code = ?,
            issued_check_total = ?,
            issued_order_code = ?,
            issued_store_code = ?,
            issued_workplace_id = ?,
            issued_rule_code = ?,
            issue_key = ?
        WHERE id = ? AND status = 'available'
      `,
      [
        input.loyaltyCode,
        input.checkTotal,
        input.orderCode,
        input.storeCode,
        input.workplaceId,
        input.ruleCode,
        key,
        availableCode.id
      ]
    );

    await connection.commit();
    return availableCode.code_value;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
