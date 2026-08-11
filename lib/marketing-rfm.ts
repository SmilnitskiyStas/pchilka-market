import type { Client } from 'pg';
import { withMarketingSource } from '@/lib/marketing-source-db';

export type RfmSegmentId = 'champions' | 'loyal' | 'potential_loyalists' | 'new_customers' | 'prospective' | 'need_attention' | 'about_to_sleep' | 'at_risk' | 'cannot_lose' | 'sleeping' | 'lost';
export type RfmSegment = { id: RfmSegmentId; label: string; description: string; customers: number; turnover: number; averageCheck: number };
export type RfmReport = { generatedAt: string; period: { from: string; to: string; days: number }; totals: { customers: number; orders: number; turnover: number; averageCheck: number; registeredCustomers: number }; segments: RfmSegment[]; recommendations: string[] };
export type RfmSegmentDetail = { segment: RfmSegment; behavior: { orders: number; ordersPerCustomer: number; averageRecencyDays: number; latestVisit: string | null; averageLifetimeValue: number; totalLifetimeValue: number; busiestWeekday: string | null; busiestHour: string | null; weekdayDistribution: Array<{ label: string; share: number }>; topHours: Array<{ label: string; share: number }> }; topProducts: Array<{ code: string; name: string; barcode: string | null; customers: number; orders: number; reach: number }>; recommendation: { trigger: string; action: string; offer: string; warning: string } };
export type RfmSegmentBehavior = { busiestWeekday: string | null; busiestHour: string | null; weekdayDistribution: Array<{ label: string; share: number }>; topHours: Array<{ label: string; share: number }> };
export type RfmSegmentCustomer = { customerCode: string; consumerUid?: string | null; fullName?: string | null; mobilePhone?: string | null; orders: number; turnover: number; lastPurchase: string | null };
type CustomerRow = { customer_id: string; orders: string; turnover: string; recency_days: string; latest_visit: string | null; r_score: string; f_score: string; m_score: string };

const meta: Record<RfmSegmentId, Omit<RfmSegment, 'customers' | 'turnover' | 'averageCheck'>> = {
  champions: { id: 'champions', label: 'Чемпіони', description: 'VIP-ядро бази' }, loyal: { id: 'loyal', label: 'Лояльні', description: 'Стабільне ядро' }, potential_loyalists: { id: 'potential_loyalists', label: 'Потенційно лояльні', description: 'Кандидати в ядро' }, new_customers: { id: 'new_customers', label: 'Нові', description: 'Перша покупка ≤ 30 днів' }, prospective: { id: 'prospective', label: 'Перспективні', description: 'Активні, але рідкі' }, need_attention: { id: 'need_attention', label: 'Потребують уваги', description: 'Середні в усьому' }, about_to_sleep: { id: 'about_to_sleep', label: 'Засинають', description: 'Зменшують частоту' }, at_risk: { id: 'at_risk', label: 'Під ризиком', description: 'Колишні Loyal без покупок' }, cannot_lose: { id: 'cannot_lose', label: 'Не можна втратити', description: 'Колишні Champions' }, sleeping: { id: 'sleeping', label: 'Сплячі', description: 'Дуже стара база' }, lost: { id: 'lost', label: 'Втрачені', description: 'Одна покупка > 6 міс. тому' }
};
const ids: RfmSegmentId[] = ['champions', 'loyal', 'potential_loyalists', 'new_customers', 'prospective', 'need_attention', 'about_to_sleep', 'at_risk', 'cannot_lose', 'sleeping', 'lost'];
const cache = new Map<string, { expiresAt: number; rows: CustomerRow[] }>();
const number = (value: number) => value.toLocaleString('uk-UA');
function period(days: number) { const normalizedDays = days === 90 ? 90 : days === 365 ? 365 : 180; const end = new Date(); const start = new Date(end); start.setUTCDate(start.getUTCDate() - normalizedDays + 1); return { normalizedDays, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }; }
function segmentFor(row: CustomerRow): RfmSegmentId { const r = +row.r_score, f = +row.f_score, m = +row.m_score; if (r >= 4 && f >= 4 && m >= 4) return 'champions'; if (r <= 2 && f >= 4 && m >= 4) return 'cannot_lose'; if (r >= 3 && f >= 3) return 'loyal'; if (r >= 4 && f >= 3) return 'potential_loyalists'; if (r >= 4 && f === 2) return 'prospective'; if (r >= 4 && f === 1) return 'new_customers'; if (r === 1 && f >= 2) return 'sleeping'; if (r === 1 && f === 1) return 'lost'; if (r <= 2 && f >= 3) return 'at_risk'; if (r <= 2 && f <= 2) return 'about_to_sleep'; return 'need_attention'; }

async function customers(client: Client, from: string, to: string, storeId?: number) {
  const key = `${from}:${to}:${storeId ?? 'all'}`, hit = cache.get(key); if (hit && hit.expiresAt > Date.now()) return hit.rows;
  const result = await client.query<CustomerRow>(`WITH metrics AS (SELECT code_client::text AS customer_id, COUNT(*)::bigint AS orders, SUM(COALESCE(sum_order,0))::numeric AS turnover, (CURRENT_DATE-MAX(date_order)::date)::int AS recency_days, MAX(date_order)::date::text AS latest_visit FROM pos.order_client WHERE date_order >= $1::date AND date_order < ($2::date + interval '1 day') AND ($3::int IS NULL OR code_shop=$3::int) AND code_client IS NOT NULL AND code_client <> 0 AND COALESCE(sum_order,0)>0 GROUP BY code_client) SELECT customer_id,orders::text,turnover::text,recency_days::text,latest_visit,NTILE(5) OVER (ORDER BY recency_days DESC)::text AS r_score,NTILE(5) OVER (ORDER BY orders ASC)::text AS f_score,NTILE(5) OVER (ORDER BY turnover ASC)::text AS m_score FROM metrics`, [from, to, storeId ?? null]);
  cache.set(key, { rows: result.rows, expiresAt: Date.now() + 5 * 60_000 }); return result.rows;
}
function segments(rows: CustomerRow[]) { const buckets = new Map<RfmSegmentId, { customers: number; turnover: number; orders: number }>(); ids.forEach((id) => buckets.set(id, { customers: 0, turnover: 0, orders: 0 })); rows.forEach((row) => { const bucket = buckets.get(segmentFor(row))!; bucket.customers++; bucket.orders += +row.orders; bucket.turnover += +row.turnover; }); return { buckets, list: ids.map((id) => { const b = buckets.get(id)!; return { ...meta[id], customers: b.customers, turnover: b.turnover, averageCheck: b.orders ? b.turnover / b.orders : 0 }; }) }; }

export async function getRfmReport(days: number, storeId?: number): Promise<RfmReport> { const { normalizedDays, from, to } = period(days); const { rows, registeredCustomers } = await withMarketingSource(async (client) => { const rows = await customers(client, from, to, storeId); const result = await client.query<{ registered: string }>('SELECT COUNT(*)::text AS registered FROM pos.client'); return { rows, registeredCustomers: Number(result.rows[0]?.registered ?? 0) }; }); const { buckets, list } = segments(rows); const orders = rows.reduce((sum, row) => sum + +row.orders, 0), turnover = rows.reduce((sum, row) => sum + +row.turnover, 0), champions = buckets.get('champions')!, risk = buckets.get('at_risk')!; return { generatedAt: new Date().toISOString(), period: { from, to, days: normalizedDays }, totals: { customers: rows.length, orders, turnover, averageCheck: orders ? turnover / orders : 0, registeredCustomers }, segments: list, recommendations: [champions.customers ? `Збережіть «Чемпіонів»: персональні пропозиції та ранній доступ до акцій для ${number(champions.customers)} покупців.` : 'У вибраному періоді не знайдено достатньо даних для сегмента «Чемпіони».', risk.customers ? `Запустіть win-back кампанію для «Під ризиком»: ${number(risk.customers)} покупців.` : 'Сегмент «Під ризиком» поки що порожній.', 'Перед запуском кампанії перевіряйте маржинальність товарів і не трактуйте цей звіт як причинний ефект акції.'] }; }

export async function getRfmSegmentDetail(days: number, segmentId: string): Promise<RfmSegmentDetail> { if (!ids.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.'); const id = segmentId as RfmSegmentId, { from, to } = period(days); return withMarketingSource(async (client) => { const selected = (await customers(client, from, to)).filter((row) => segmentFor(row) === id); if (!selected.length) throw new Error('У цьому сегменті немає покупців за вибраний період.'); const orders = selected.reduce((sum, row) => sum + +row.orders, 0), turnover = selected.reduce((sum, row) => sum + +row.turnover, 0), recency = selected.reduce((sum, row) => sum + +row.recency_days, 0) / selected.length, latestVisit = selected.map((row) => row.latest_visit).filter(Boolean).sort().at(-1) ?? null, recovery = ['at_risk', 'need_attention', 'about_to_sleep', 'lost'].includes(id); return { segment: { ...meta[id], customers: selected.length, turnover, averageCheck: orders ? turnover / orders : 0 }, behavior: { orders, ordersPerCustomer: orders / selected.length, averageRecencyDays: recency, latestVisit, averageLifetimeValue: turnover / selected.length, totalLifetimeValue: turnover, busiestWeekday: null, busiestHour: null, weekdayDistribution: [], topHours: [] }, topProducts: [], recommendation: recovery ? { trigger: `${number(selected.length)} покупців цього сегмента мають середню давність ${Math.round(recency)} днів.`, action: 'Спершу сформуйте окрему win-back аудиторію та протестуйте персональне повідомлення.', offer: 'Почніть з невеликого контрольованого тесту пропозиції.', warning: 'Не оцінюйте кампанію без контрольної групи.' } : { trigger: `${number(selected.length)} покупців сегмента мають середню давність ${Math.round(recency)} днів.`, action: 'Утримання через цінність, статус або ранній доступ — без масової знижки.', offer: 'Дайте ранній доступ до новинок або персональну добірку.', warning: 'Не девальвуйте лояльність постійними знижками.' } }; }); }

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

    type ProfileRow = { customer_code: string; consumer_uid: string | null; full_name: string | null; mobile_phone: string | null };
    const profiles = await client.query<ProfileRow>(`
      SELECT DISTINCT ON (code_client)
        code_client::text AS customer_code,
        NULLIF(add_info::jsonb ->> 'consumer_uid', '') AS consumer_uid,
        NULLIF(add_info::jsonb ->> 'full_name', '') AS full_name,
        NULLIF(add_info::jsonb ->> 'mobile_phone', '') AS mobile_phone
      FROM pos.order_client
      WHERE code_client = ANY($1::int[])
        AND date_order >= $2::date AND date_order < ($3::date + interval '1 day')
        AND ($4::int IS NULL OR code_shop = $4::int)
        AND add_info IS NOT NULL
      ORDER BY code_client, date_order DESC NULLS LAST
    `, [selected.map((row) => Number(row.customer_id)), from, to, storeId ?? null]);
    const profileByCustomer = new Map(profiles.rows.map((profile) => [profile.customer_code, profile]));
    return selected.map((row) => {
      const profile = profileByCustomer.get(row.customer_id);
      return { customerCode: row.customer_id, consumerUid: profile?.consumer_uid ?? null, fullName: profile?.full_name ?? null, mobilePhone: profile?.mobile_phone ?? null, orders: Number(row.orders), turnover: Number(row.turnover), lastPurchase: row.latest_visit };
    });
  });
}

export async function getRfmSegmentBehavior(days: number, segmentId: string): Promise<RfmSegmentBehavior> {
  if (!ids.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.');
  const id = segmentId as RfmSegmentId, { from, to } = period(days);
  return withMarketingSource(async (client) => {
    const selected = (await customers(client, from, to)).filter((row) => segmentFor(row) === id);
    if (!selected.length) throw new Error('У цьому сегменті немає покупців за вибраний період.');
    const result = await client.query<{ weekday: string; hour: string; orders: string }>(`
      SELECT EXTRACT(DOW FROM date_order)::int::text AS weekday,
        EXTRACT(HOUR FROM date_order)::int::text AS hour, COUNT(*)::text AS orders
      FROM pos.order_client
      WHERE date_order >= $1::date AND date_order < ($2::date + interval '1 day')
        AND COALESCE(sum_order, 0) > 0 AND code_client = ANY($3::int[])
      GROUP BY 1, 2
    `, [from, to, selected.map((row) => Number(row.customer_id))]);
    const total = selected.reduce((sum, row) => sum + Number(row.orders), 0);
    const weekdayLabels = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const weekdayDistribution = weekdayLabels.map((label, weekday) => ({
      label, share: total ? result.rows.filter((row) => Number(row.weekday) === weekday).reduce((sum, row) => sum + Number(row.orders), 0) / total * 100 : 0
    }));
    const topHours = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, '0')}:00`, share: total ? result.rows.filter((row) => Number(row.hour) === hour).reduce((sum, row) => sum + Number(row.orders), 0) / total * 100 : 0
    })).sort((a, b) => b.share - a.share).slice(0, 3);
    return { busiestWeekday: weekdayDistribution.reduce((best, item) => item.share > best.share ? item : best, weekdayDistribution[0])?.label ?? null, busiestHour: topHours[0]?.label ?? null, weekdayDistribution, topHours };
  });
}
