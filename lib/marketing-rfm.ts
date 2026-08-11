import type { Client } from 'pg';
import { withMarketingSource } from '@/lib/marketing-source-db';

export type RfmSegmentId = 'champions' | 'loyal' | 'potential_loyalists' | 'new_customers' | 'prospective' | 'need_attention' | 'about_to_sleep' | 'at_risk' | 'cannot_lose' | 'sleeping' | 'lost';
export type RfmSegment = { id: RfmSegmentId; label: string; description: string; customers: number; turnover: number; averageCheck: number };
export type RfmReport = { generatedAt: string; period: { from: string; to: string; days: number }; totals: { customers: number; orders: number; turnover: number; averageCheck: number; registeredCustomers: number }; segments: RfmSegment[]; recommendations: string[] };
export type RfmSegmentDetail = { segment: RfmSegment; behavior: { orders: number; ordersPerCustomer: number; averageRecencyDays: number; latestVisit: string | null; averageLifetimeValue: number; totalLifetimeValue: number; busiestWeekday: string | null; busiestHour: string | null; weekdayDistribution: Array<{ label: string; share: number }>; topHours: Array<{ label: string; share: number }> }; topProducts: Array<{ code: string; name: string; barcode: string | null; customers: number; orders: number; reach: number }>; recommendation: { trigger: string; action: string; offer: string; warning: string } };
export type RfmSegmentBehavior = { busiestWeekday: string | null; busiestHour: string | null; weekdayDistribution: Array<{ label: string; weekday: number; share: number }>; hourlyDistribution: Array<{ label: string; share: number }>; weekdayHourlyDistribution: Array<{ weekday: number; hour: number; orders: number }>; topHours: Array<{ label: string; share: number }> };
export type RfmSegmentCustomer = { customerCode: string; sourceCode?: string | null; consumerUid?: string | null; fullName?: string | null; mobilePhone?: string | null; orders: number; turnover: number; lastPurchase: string | null };
export type RfmSegmentTopProduct = { code: string; name: string; customers: number; orders: number; units: number; turnover: number; reach: number };
export type RfmRelatedProduct = { code: string; name: string; customers: number; sharedOrders: number; baseReach: number; segmentReach: number; affinity: number; togetherShare: number };
export type RfmProductRelations = { baseCustomers: number; baseOrders: number; affinity: RfmRelatedProduct[]; together: RfmRelatedProduct[] };
export type RfmMigrationReport = { sourceStoreId: string; customers: number; destinations: Array<{ storeId: string; customers: number; share: number }>; migratedCustomers: Array<{ consumerUid: string; fullName: string | null; mobilePhone: string | null; destinationStoreId: string; lastVisit: string | null }> };
type CustomerRow = { customer_id: string; orders: string; turnover: string; recency_days: string; latest_visit: string | null; r_score: string; f_score: string; m_score: string };

const meta: Record<RfmSegmentId, Omit<RfmSegment, 'customers' | 'turnover' | 'averageCheck'>> = {
  champions: { id: 'champions', label: 'Чемпіони', description: 'VIP-ядро бази' }, loyal: { id: 'loyal', label: 'Лояльні', description: 'Стабільне ядро' }, potential_loyalists: { id: 'potential_loyalists', label: 'Потенційно лояльні', description: 'Кандидати в ядро' }, new_customers: { id: 'new_customers', label: 'Нові', description: 'Перша покупка ≤ 30 днів' }, prospective: { id: 'prospective', label: 'Перспективні', description: 'Активні, але рідкі' }, need_attention: { id: 'need_attention', label: 'Потребують уваги', description: 'Середні в усьому' }, about_to_sleep: { id: 'about_to_sleep', label: 'Засинають', description: 'Зменшують частоту' }, at_risk: { id: 'at_risk', label: 'Під ризиком', description: 'Колишні Loyal без покупок' }, cannot_lose: { id: 'cannot_lose', label: 'Не можна втратити', description: 'Колишні Champions' }, sleeping: { id: 'sleeping', label: 'Сплячі', description: 'Дуже стара база' }, lost: { id: 'lost', label: 'Втрачені', description: 'Одна покупка > 6 міс. тому' }
};
const ids: RfmSegmentId[] = ['champions', 'loyal', 'potential_loyalists', 'new_customers', 'prospective', 'need_attention', 'about_to_sleep', 'at_risk', 'cannot_lose', 'sleeping', 'lost'];
const cache = new Map<string, { expiresAt: number; rows: CustomerRow[] }>();
const migrationCache = new Map<string, { expiresAt: number; report: RfmMigrationReport }>();
const number = (value: number) => value.toLocaleString('uk-UA');
function period(days: number) { const normalizedDays = days === 90 ? 90 : days === 365 ? 365 : 180; const end = new Date(); const start = new Date(end); start.setUTCDate(start.getUTCDate() - normalizedDays + 1); return { normalizedDays, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }; }
function segmentFor(row: CustomerRow): RfmSegmentId { const r = +row.r_score, f = +row.f_score, m = +row.m_score; if (r >= 4 && f >= 4 && m >= 4) return 'champions'; if (r <= 2 && f >= 4 && m >= 4) return 'cannot_lose'; if (r >= 3 && f >= 3) return 'loyal'; if (r >= 4 && f >= 3) return 'potential_loyalists'; if (r >= 4 && f === 2) return 'prospective'; if (r >= 4 && f === 1) return 'new_customers'; if (r === 1 && f >= 2) return 'sleeping'; if (r === 1 && f === 1) return 'lost'; if (r <= 2 && f >= 3) return 'at_risk'; if (r <= 2 && f <= 2) return 'about_to_sleep'; return 'need_attention'; }

async function customers(client: Client, from: string, to: string, storeId?: number) {
  const key = `${from}:${to}:${storeId ?? 'all'}`, hit = cache.get(key); if (hit && hit.expiresAt > Date.now()) return hit.rows;
  const result = await client.query<CustomerRow>(`WITH identified_orders AS (SELECT COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')) AS customer_id, date_order, sum_order FROM pos.order_client WHERE date_order >= $1::date AND date_order < ($2::date + interval '1 day') AND ($3::int IS NULL OR code_shop=$3::int) AND add_info IS NOT NULL AND COALESCE(sum_order,0)>0), metrics AS (SELECT customer_id, COUNT(*)::bigint AS orders, SUM(COALESCE(sum_order,0))::numeric AS turnover, (CURRENT_DATE-MAX(date_order)::date)::int AS recency_days, MAX(date_order)::date::text AS latest_visit FROM identified_orders WHERE customer_id IS NOT NULL GROUP BY customer_id) SELECT customer_id,orders::text,turnover::text,recency_days::text,latest_visit,NTILE(5) OVER (ORDER BY recency_days DESC)::text AS r_score,NTILE(5) OVER (ORDER BY orders ASC)::text AS f_score,NTILE(5) OVER (ORDER BY turnover ASC)::text AS m_score FROM metrics`, [from, to, storeId ?? null]);
  cache.set(key, { rows: result.rows, expiresAt: Date.now() + 5 * 60_000 }); return result.rows;
}
function segments(rows: CustomerRow[]) { const buckets = new Map<RfmSegmentId, { customers: number; turnover: number; orders: number }>(); ids.forEach((id) => buckets.set(id, { customers: 0, turnover: 0, orders: 0 })); rows.forEach((row) => { const bucket = buckets.get(segmentFor(row))!; bucket.customers++; bucket.orders += +row.orders; bucket.turnover += +row.turnover; }); return { buckets, list: ids.map((id) => { const b = buckets.get(id)!; return { ...meta[id], customers: b.customers, turnover: b.turnover, averageCheck: b.orders ? b.turnover / b.orders : 0 }; }) }; }

export async function getRfmReport(days: number, storeId?: number): Promise<RfmReport> { const { normalizedDays, from, to } = period(days); const { rows, registeredCustomers } = await withMarketingSource(async (client) => { const rows = await customers(client, from, to, storeId); const result = await client.query<{ registered: string }>('SELECT COUNT(*)::text AS registered FROM pos.client'); return { rows, registeredCustomers: Number(result.rows[0]?.registered ?? 0) }; }); const { buckets, list } = segments(rows); const orders = rows.reduce((sum, row) => sum + +row.orders, 0), turnover = rows.reduce((sum, row) => sum + +row.turnover, 0), champions = buckets.get('champions')!, risk = buckets.get('at_risk')!; return { generatedAt: new Date().toISOString(), period: { from, to, days: normalizedDays }, totals: { customers: rows.length, orders, turnover, averageCheck: orders ? turnover / orders : 0, registeredCustomers }, segments: list, recommendations: [champions.customers ? `Збережіть «Чемпіонів»: персональні пропозиції та ранній доступ до акцій для ${number(champions.customers)} покупців.` : 'У вибраному періоді не знайдено достатньо даних для сегмента «Чемпіони».', risk.customers ? `Запустіть win-back кампанію для «Під ризиком»: ${number(risk.customers)} покупців.` : 'Сегмент «Під ризиком» поки що порожній.', 'Перед запуском кампанії перевіряйте маржинальність товарів і не трактуйте цей звіт як причинний ефект акції.'] }; }

export async function getRfmSegmentDetail(days: number, segmentId: string): Promise<RfmSegmentDetail> { if (!ids.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.'); const id = segmentId as RfmSegmentId, { from, to } = period(days); return withMarketingSource(async (client) => { const selected = (await customers(client, from, to)).filter((row) => segmentFor(row) === id); if (!selected.length) throw new Error('У цьому сегменті немає покупців за вибраний період.'); const orders = selected.reduce((sum, row) => sum + +row.orders, 0), turnover = selected.reduce((sum, row) => sum + +row.turnover, 0), recency = selected.reduce((sum, row) => sum + +row.recency_days, 0) / selected.length, latestVisit = selected.map((row) => row.latest_visit).filter(Boolean).sort().at(-1) ?? null, recovery = ['at_risk', 'need_attention', 'about_to_sleep', 'lost'].includes(id); return { segment: { ...meta[id], customers: selected.length, turnover, averageCheck: orders ? turnover / orders : 0 }, behavior: { orders, ordersPerCustomer: orders / selected.length, averageRecencyDays: recency, latestVisit, averageLifetimeValue: turnover / selected.length, totalLifetimeValue: turnover, busiestWeekday: null, busiestHour: null, weekdayDistribution: [], topHours: [] }, topProducts: [], recommendation: recovery ? { trigger: `${number(selected.length)} покупців цього сегмента мають середню давність ${Math.round(recency)} днів.`, action: 'Спершу сформуйте окрему win-back аудиторію та протестуйте персональне повідомлення.', offer: 'Почніть з невеликого контрольованого тесту пропозиції.', warning: 'Не оцінюйте кампанію без контрольної групи.' } : { trigger: `${number(selected.length)} покупців сегмента мають середню давність ${Math.round(recency)} днів.`, action: 'Утримання через цінність, статус або ранній доступ — без масової знижки.', offer: 'Дайте ранній доступ до новинок або персональну добірку.', warning: 'Не девальвуйте лояльність постійними знижками.' } }; }); }

export async function getRfmSegmentDetailForStore(days: number, segmentId: string, storeId?: number): Promise<RfmSegmentDetail> {
  if (!ids.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.');
  const id = segmentId as RfmSegmentId, { from, to } = period(days);
  return withMarketingSource(async (client) => {
    const selected = (await customers(client, from, to, storeId)).filter((row) => segmentFor(row) === id);
    if (!selected.length) throw new Error('У цьому сегменті немає покупців за вибраний період.');
    const orders = selected.reduce((sum, row) => sum + Number(row.orders), 0);
    const turnover = selected.reduce((sum, row) => sum + Number(row.turnover), 0);
    const recency = selected.reduce((sum, row) => sum + Number(row.recency_days), 0) / selected.length;
    const latestVisit = selected.map((row) => row.latest_visit).filter(Boolean).sort().at(-1) ?? null;
    const recovery = ['at_risk', 'need_attention', 'about_to_sleep', 'lost'].includes(id);
    return { segment: { ...meta[id], customers: selected.length, turnover, averageCheck: orders ? turnover / orders : 0 }, behavior: { orders, ordersPerCustomer: orders / selected.length, averageRecencyDays: recency, latestVisit, averageLifetimeValue: turnover / selected.length, totalLifetimeValue: turnover, busiestWeekday: null, busiestHour: null, weekdayDistribution: [], topHours: [] }, topProducts: [], recommendation: recovery ? { trigger: `${number(selected.length)} покупців цього сегмента мають середню давність ${Math.round(recency)} днів.`, action: 'Спершу сформуйте окрему win-back аудиторію та протестуйте персональне повідомлення.', offer: 'Почніть з невеликого контрольованого тесту пропозиції.', warning: 'Не оцінюйте кампанію без контрольної групи.' } : { trigger: `${number(selected.length)} покупців сегмента мають середню давність ${Math.round(recency)} днів.`, action: 'Утримання через цінність, статус або ранній доступ — без масової знижки.', offer: 'Дайте ранній доступ до новинок або персональну добірку.', warning: 'Не девальвуйте лояльність постійними знижками.' } };
  });
}

export async function getRfmSegmentCustomers(days: number, segmentId: string): Promise<RfmSegmentCustomer[]> { if (!ids.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.'); const { from, to } = period(days); return withMarketingSource(async (client) => (await customers(client, from, to)).filter((row) => segmentFor(row) === segmentId).sort((a,b) => Number(b.turnover) - Number(a.turnover)).slice(0,50).map((row) => ({ customerCode: row.customer_id, orders: Number(row.orders), turnover: Number(row.turnover), lastPurchase: row.latest_visit }))); }

export async function getRfmSegmentCustomersWithProfiles(days: number, segmentId: string, storeId?: number): Promise<RfmSegmentCustomer[]> {
  if (!ids.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.');
  const { from, to } = period(days);
  return withMarketingSource(async (client) => {
    const selected = (await customers(client, from, to, storeId))
      .filter((row) => segmentFor(row) === segmentId)
      .sort((a, b) => Number(b.turnover) - Number(a.turnover))
      .slice(0, 50);
    if (!selected.length) return [];

    type ProfileRow = { customer_code: string; source_code: string | null; consumer_uid: string | null; full_name: string | null; mobile_phone: string | null };
    const profiles = await client.query<ProfileRow>(`
      SELECT DISTINCT ON (COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')))
        COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')) AS customer_code,
        code_client::text AS source_code,
        COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')) AS consumer_uid,
        NULLIF(add_info::jsonb ->> 'full_name', '') AS full_name,
        NULLIF(add_info::jsonb ->> 'mobile_phone', '') AS mobile_phone
      FROM pos.order_client
      WHERE COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')) = ANY($1::text[])
        AND date_order >= $2::date AND date_order < ($3::date + interval '1 day')
        AND ($4::int IS NULL OR code_shop = $4::int)
        AND add_info IS NOT NULL
      ORDER BY COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')), date_order DESC NULLS LAST
    `, [selected.map((row) => row.customer_id), from, to, storeId ?? null]);
    const profileByCustomer = new Map(profiles.rows.map((profile) => [profile.customer_code, profile]));
    return selected.map((row) => {
      const profile = profileByCustomer.get(row.customer_id);
      return { customerCode: row.customer_id, sourceCode: profile?.source_code ?? null, consumerUid: profile?.consumer_uid ?? null, fullName: profile?.full_name ?? null, mobilePhone: profile?.mobile_phone ?? null, orders: Number(row.orders), turnover: Number(row.turnover), lastPurchase: row.latest_visit };
    });
  });
}

export async function getRfmSegmentTopProducts(days: number, segmentId: string, storeId?: number): Promise<RfmSegmentTopProduct[]> {
  if (!ids.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.');
  const { from, to } = period(days);
  return withMarketingSource(async (client) => {
    const selected = (await customers(client, from, to, storeId)).filter((row) => segmentFor(row) === segmentId);
    if (!selected.length) return [];
    type ProductRow = { code: string; name: string | null; customers: string; orders: string; units: string; turnover: string };
    const result = await client.query<ProductRow>(`
      WITH segment_orders AS (
        SELECT code_order, code_shop, id_workplace,
          COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')) AS customer_id
        FROM pos.order_client
        WHERE date_order >= $1::date AND date_order < ($2::date + interval '1 day')
          AND ($3::int IS NULL OR code_shop = $3::int)
          AND COALESCE(sum_order, 0) > 0
          AND COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')) = ANY($4::text[])
      )
      SELECT wo.code_wares::text AS code, MAX(COALESCE(w.name_wares_receipt, w.name_wares)) AS name,
        COUNT(DISTINCT so.customer_id)::text AS customers,
        COUNT(DISTINCT (so.code_order, so.code_shop, so.id_workplace))::text AS orders,
        SUM(COALESCE(wo.quantity, 0))::text AS units,
        SUM(COALESCE(wo.sum_position, wo.quantity * wo.price, 0))::text AS turnover
      FROM segment_orders so
      JOIN pos.wares_order wo ON wo.code_order = so.code_order AND wo.code_shop = so.code_shop AND wo.id_workplace = so.id_workplace
      LEFT JOIN pos.wares w ON w.code_wares = wo.code_wares
      WHERE COALESCE(wo.quantity, 0) > 0
      GROUP BY wo.code_wares
      ORDER BY COUNT(DISTINCT so.customer_id) DESC, SUM(COALESCE(wo.sum_position, wo.quantity * wo.price, 0)) DESC
      LIMIT 20
    `, [from, to, storeId ?? null, selected.map((row) => row.customer_id)]);
    return result.rows.map((row) => ({ code: row.code, name: row.name ?? `Товар ${row.code}`, customers: Number(row.customers), orders: Number(row.orders), units: Number(row.units), turnover: Number(row.turnover), reach: Number(row.customers) / selected.length * 100 }));
  });
}

export async function getRfmProductRelations(days: number, segmentId: string, productCode: string, storeId?: number): Promise<RfmProductRelations> {
  if (!ids.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.');
  if (!/^\d+$/.test(productCode)) throw new Error('Некоректний код товару.');
  const { from, to } = period(days);
  return withMarketingSource(async (client) => {
    const selected = (await customers(client, from, to, storeId)).filter((row) => segmentFor(row) === segmentId);
    if (!selected.length) return { baseCustomers: 0, baseOrders: 0, affinity: [], together: [] };
    type RelationRow = { code: string; name: string | null; customers: string; shared_orders: string; segment_customers: string; base_customers: string; base_orders: string };
    const result = await client.query<RelationRow>(`
      WITH segment_orders AS (
        SELECT code_order, code_shop, id_workplace,
          COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')) AS customer_id
        FROM pos.order_client
        WHERE date_order >= $1::date AND date_order < ($2::date + interval '1 day')
          AND ($3::int IS NULL OR code_shop = $3::int)
          AND COALESCE(sum_order, 0) > 0
          AND COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')) = ANY($4::text[])
      ), base_orders AS (
        SELECT DISTINCT so.code_order, so.code_shop, so.id_workplace, so.customer_id
        FROM segment_orders so
        JOIN pos.wares_order wo ON wo.code_order = so.code_order AND wo.code_shop = so.code_shop AND wo.id_workplace = so.id_workplace
        WHERE wo.code_wares = $5::int AND COALESCE(wo.quantity, 0) > 0
      ), base_summary AS (
        SELECT COUNT(DISTINCT customer_id)::text AS base_customers, COUNT(*)::text AS base_orders FROM base_orders
      ), co_products AS (
        SELECT wo.code_wares::text AS code, MAX(COALESCE(w.name_wares_receipt, w.name_wares)) AS name,
          COUNT(DISTINCT bo.customer_id)::text AS customers, COUNT(DISTINCT (bo.code_order, bo.code_shop, bo.id_workplace))::text AS shared_orders
        FROM base_orders bo
        JOIN pos.wares_order wo ON wo.code_order = bo.code_order AND wo.code_shop = bo.code_shop AND wo.id_workplace = bo.id_workplace
        LEFT JOIN pos.wares w ON w.code_wares = wo.code_wares
        WHERE wo.code_wares <> $5::int AND COALESCE(wo.quantity, 0) > 0
        GROUP BY wo.code_wares
      ), segment_product_reach AS (
        SELECT wo.code_wares::text AS code, COUNT(DISTINCT so.customer_id)::text AS segment_customers
        FROM segment_orders so
        JOIN pos.wares_order wo ON wo.code_order = so.code_order AND wo.code_shop = so.code_shop AND wo.id_workplace = so.id_workplace
        WHERE COALESCE(wo.quantity, 0) > 0
        GROUP BY wo.code_wares
      )
      SELECT co.code, co.name, co.customers, co.shared_orders, reach.segment_customers, summary.base_customers, summary.base_orders
      FROM co_products co
      JOIN segment_product_reach reach ON reach.code = co.code
      CROSS JOIN base_summary summary
      ORDER BY co.customers DESC
      LIMIT 100
    `, [from, to, storeId ?? null, selected.map((row) => row.customer_id), Number(productCode)]);
    const rows = result.rows.map((row) => {
      const baseCustomers = Number(row.base_customers), baseOrders = Number(row.base_orders), customers = Number(row.customers), segmentCustomers = Number(row.segment_customers);
      const baseReach = baseCustomers ? customers / baseCustomers * 100 : 0;
      const segmentReach = selected.length ? segmentCustomers / selected.length * 100 : 0;
      return { code: row.code, name: row.name ?? `Товар ${row.code}`, customers, sharedOrders: Number(row.shared_orders), baseReach, segmentReach, affinity: segmentReach ? baseReach / segmentReach : 0, togetherShare: baseOrders ? Number(row.shared_orders) / baseOrders * 100 : 0 };
    });
    const baseCustomers = Number(result.rows[0]?.base_customers ?? 0), baseOrders = Number(result.rows[0]?.base_orders ?? 0);
    return { baseCustomers, baseOrders, affinity: [...rows].sort((a, b) => b.affinity - a.affinity || b.customers - a.customers).slice(0, 20), together: [...rows].sort((a, b) => b.togetherShare - a.togetherShare || b.sharedOrders - a.sharedOrders).slice(0, 20) };
  });
}

export async function getRfmMigrationReport(days: number, sourceStoreId: number): Promise<RfmMigrationReport> {
  if (!Number.isInteger(sourceStoreId)) throw new Error('Оберіть коректний магазин.');
  const { from, to } = period(days);
  const cacheKey = `${from}:${to}:${sourceStoreId}`;
  const cached = migrationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.report;
  const identity = `COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', ''))`;
  return withMarketingSource(async (client) => {
    type SourceRow = { customer_id: string; code_client: string; source_last_visit: Date };
    type TargetRow = { code_client: string; consumer_uid: string | null; full_name: string | null; mobile_phone: string | null; destination_store_id: string; visit_at: Date };
    const source = await client.query<SourceRow>(`SELECT ${identity} AS customer_id, code_client::text AS code_client, MAX(COALESCE(date_receipt, date_close, date_open, date_order)) AS source_last_visit FROM pos.order_client WHERE code_shop = $3::int AND date_order >= $1::date AND date_order < ($2::date + interval '1 day') AND COALESCE(sum_order, 0) > 0 AND ${identity} IS NOT NULL AND code_client IS NOT NULL GROUP BY 1, 2`, [from, to, sourceStoreId]);
    const sourceCodes = Array.from(new Set(source.rows.map((row) => Number(row.code_client)).filter(Number.isFinite)));
    if (!sourceCodes.length) return { sourceStoreId: String(sourceStoreId), customers: 0, destinations: [], migratedCustomers: [] };
    const targets = await client.query<TargetRow>(`SELECT code_client::text AS code_client, ${identity} AS consumer_uid, NULLIF(add_info::jsonb ->> 'full_name', '') AS full_name, NULLIF(add_info::jsonb ->> 'mobile_phone', '') AS mobile_phone, code_shop::text AS destination_store_id, COALESCE(date_receipt, date_close, date_open, date_order) AS visit_at FROM pos.order_client WHERE code_client = ANY($4::int[]) AND code_shop <> $3::int AND date_order >= $1::date AND date_order < ($2::date + interval '1 day') AND COALESCE(sum_order, 0) > 0`, [from, to, sourceStoreId, sourceCodes]);
    const sourceVisits = new Map(source.rows.map((row) => [`${row.code_client}:${row.customer_id}`, new Date(row.source_last_visit).getTime()]));
    const latestByCustomer = new Map<string, TargetRow>();
    targets.rows.forEach((row) => { if (!row.consumer_uid || sourceVisits.get(`${row.code_client}:${row.consumer_uid}`) === undefined || new Date(row.visit_at).getTime() <= sourceVisits.get(`${row.code_client}:${row.consumer_uid}`)!) return; const previous = latestByCustomer.get(row.consumer_uid); if (!previous || new Date(row.visit_at).getTime() > new Date(previous.visit_at).getTime()) latestByCustomer.set(row.consumer_uid, row); });
    const result = Array.from(latestByCustomer.values()).sort((a, b) => new Date(b.visit_at).getTime() - new Date(a.visit_at).getTime());
    const total = result.length;
    const destinations = new Map<string, number>();
    result.forEach((row) => destinations.set(row.destination_store_id, (destinations.get(row.destination_store_id) ?? 0) + 1));
    const report: RfmMigrationReport = { sourceStoreId: String(sourceStoreId), customers: total, destinations: Array.from(destinations, ([storeId, customers]) => ({ storeId, customers, share: total ? customers / total * 100 : 0 })).sort((a, b) => b.customers - a.customers).slice(0, 10), migratedCustomers: result.slice(0, 100).map((row) => ({ consumerUid: row.consumer_uid!, fullName: row.full_name, mobilePhone: row.mobile_phone, destinationStoreId: row.destination_store_id, lastVisit: new Date(row.visit_at).toISOString().slice(0, 10) })) };
    migrationCache.set(cacheKey, { report, expiresAt: Date.now() + 5 * 60_000 });
    return report;
  });
}

export async function getRfmSegmentBehavior(days: number, segmentId: string, storeId?: number): Promise<RfmSegmentBehavior> {
  if (!ids.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.');
  const id = segmentId as RfmSegmentId, { from, to } = period(days);
  return withMarketingSource(async (client) => {
    const selected = (await customers(client, from, to, storeId)).filter((row) => segmentFor(row) === id);
    if (!selected.length) throw new Error('У цьому сегменті немає покупців за вибраний період.');
    const result = await client.query<{ weekday: string; hour: string; orders: string }>(`
      SELECT EXTRACT(DOW FROM COALESCE(date_receipt, date_close, date_open, date_order))::int::text AS weekday,
        EXTRACT(HOUR FROM COALESCE(date_receipt, date_close, date_open, date_order))::int::text AS hour, COUNT(*)::text AS orders
      FROM pos.order_client
      WHERE date_order >= $1::date AND date_order < ($2::date + interval '1 day')
        AND ($3::int IS NULL OR code_shop = $3::int)
        AND COALESCE(sum_order, 0) > 0 AND COALESCE(NULLIF(add_info::jsonb -> 'UPLOYAL' ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'consumer_uid', ''), NULLIF(add_info::jsonb ->> 'uployal_client_id', '')) = ANY($4::text[])
      GROUP BY 1, 2
    `, [from, to, storeId ?? null, selected.map((row) => row.customer_id)]);
    const total = selected.reduce((sum, row) => sum + Number(row.orders), 0);
    const weekdayOrder = [{ label: 'Пн', weekday: 1 }, { label: 'Вт', weekday: 2 }, { label: 'Ср', weekday: 3 }, { label: 'Чт', weekday: 4 }, { label: 'Пт', weekday: 5 }, { label: 'Сб', weekday: 6 }, { label: 'Нд', weekday: 0 }];
    const weekdayDistribution = weekdayOrder.map(({ label, weekday }) => ({
      label, weekday, share: total ? result.rows.filter((row) => Number(row.weekday) === weekday).reduce((sum, row) => sum + Number(row.orders), 0) / total * 100 : 0
    }));
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, '0')}:00`, share: total ? result.rows.filter((row) => Number(row.hour) === hour).reduce((sum, row) => sum + Number(row.orders), 0) / total * 100 : 0
    }));
    const topHours = [...hourlyDistribution].sort((a, b) => b.share - a.share).slice(0, 3);
    const weekdayHourlyDistribution = result.rows.map((row) => ({ weekday: (Number(row.weekday) + 6) % 7, hour: Number(row.hour), orders: Number(row.orders) }));
    return { busiestWeekday: weekdayDistribution.reduce((best, item) => item.share > best.share ? item : best, weekdayDistribution[0])?.label ?? null, busiestHour: topHours[0]?.label ?? null, weekdayDistribution, hourlyDistribution, weekdayHourlyDistribution, topHours };
  });
}
