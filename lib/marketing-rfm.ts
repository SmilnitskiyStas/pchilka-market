import type { Client } from 'pg';

import { withMarketingSource } from '@/lib/marketing-source-db';

export type RfmSegmentId = 'champions' | 'loyal' | 'potential_loyalists' | 'new_customers' | 'at_risk' | 'need_attention' | 'about_to_sleep' | 'lost';
export type RfmSegment = { id: RfmSegmentId; label: string; description: string; customers: number; turnover: number; averageCheck: number };
export type RfmReport = { generatedAt: string; period: { from: string; to: string; days: number }; totals: { customers: number; orders: number; turnover: number; averageCheck: number }; segments: RfmSegment[]; recommendations: string[] };
export type RfmSegmentDetail = {
  segment: RfmSegment;
  behavior: { orders: number; ordersPerCustomer: number; averageRecencyDays: number; latestVisit: string | null; averageLifetimeValue: number; totalLifetimeValue: number; busiestWeekday: string | null; busiestHour: string | null; weekdayDistribution: Array<{ label: string; share: number }>; topHours: Array<{ label: string; share: number }> };
  topProducts: Array<{ code: string; name: string; barcode: string | null; customers: number; orders: number; reach: number }>;
  recommendation: { trigger: string; action: string; offer: string; warning: string };
};

type CustomerRow = { customer_id: string; orders: string; turnover: string; recency_days: string; r_score: string; f_score: string; m_score: string };
type DetailRow = { latest_visit: string | null; weekday: string | null; hour: string | null; orders: string; products: Array<{ code: string; name: string; barcode: string | null; customers: string; orders: string }> };

const meta: Record<RfmSegmentId, Omit<RfmSegment, 'customers' | 'turnover' | 'averageCheck'>> = {
  champions: { id: 'champions', label: 'Чемпіони', description: 'Найцінніші та найактивніші покупці.' }, loyal: { id: 'loyal', label: 'Лояльні', description: 'Регулярно повертаються та формують стабільний оборот.' }, potential_loyalists: { id: 'potential_loyalists', label: 'Потенційно лояльні', description: 'Недавні покупці з потенціалом для розвитку звички.' }, new_customers: { id: 'new_customers', label: 'Нові', description: 'Зробили недавню першу або одиничну покупку.' }, at_risk: { id: 'at_risk', label: 'Під ризиком', description: 'Раніше були цінними, але давно не поверталися.' }, need_attention: { id: 'need_attention', label: 'Потребують уваги', description: 'Активність знижується; варто повернути інтерес.' }, about_to_sleep: { id: 'about_to_sleep', label: 'Засинають', description: 'Низька частота і давня остання покупка.' }, lost: { id: 'lost', label: 'Втрачені', description: 'Найнижча поточна ймовірність повернення.' }
};
const segmentOrder: RfmSegmentId[] = ['champions', 'loyal', 'potential_loyalists', 'new_customers', 'at_risk', 'need_attention', 'about_to_sleep', 'lost'];
const weekdays = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const number = (value: number) => value.toLocaleString('uk-UA');
const customerCache = new Map<string, { expiresAt: number; rows: CustomerRow[] }>();

function period(days: number) { const normalizedDays = days === 90 ? 90 : days === 365 ? 365 : 180; const end = new Date(); const start = new Date(end); start.setUTCDate(start.getUTCDate() - normalizedDays + 1); return { normalizedDays, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }; }
function segmentFor(row: CustomerRow): RfmSegmentId { const r = Number(row.r_score), f = Number(row.f_score), m = Number(row.m_score); if (r >= 4 && f >= 4 && m >= 4) return 'champions'; if (r >= 3 && f >= 3) return 'loyal'; if (r >= 4 && f >= 2) return 'potential_loyalists'; if (r >= 4 && f === 1) return 'new_customers'; if (r <= 2 && f >= 3 && m >= 3) return 'at_risk'; if (r <= 3 && f >= 2) return 'need_attention'; if (r <= 2 && f === 1) return 'about_to_sleep'; return 'lost'; }

async function loadCustomers(client: Client, from: string, to: string): Promise<CustomerRow[]> {
  const result = await client.query<CustomerRow>(`
    WITH customer_metrics AS (
      SELECT code_client::text AS customer_id, COUNT(*)::bigint AS orders, SUM(COALESCE(sum_order, 0))::numeric AS turnover,
        (CURRENT_DATE - MAX(date_order)::date)::int AS recency_days
      FROM pos.order_client
      WHERE date_order >= $1::date AND date_order < ($2::date + interval '1 day')
        AND code_client IS NOT NULL AND code_client <> 0 AND COALESCE(sum_order, 0) > 0
      GROUP BY code_client
    ) SELECT customer_id, orders::text, turnover::text, recency_days::text,
      NTILE(5) OVER (ORDER BY recency_days DESC)::text AS r_score, NTILE(5) OVER (ORDER BY orders ASC)::text AS f_score,
      NTILE(5) OVER (ORDER BY turnover ASC)::text AS m_score FROM customer_metrics`, [from, to]);
  return result.rows;
}

async function loadCachedCustomers(client: Client, from: string, to: string): Promise<CustomerRow[]> {
  const key = `${from}:${to}`;
  const cached = customerCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;
  const rows = await loadCustomers(client, from, to);
  customerCache.set(key, { rows, expiresAt: Date.now() + 5 * 60_000 });
  return rows;
}

function makeSegments(rows: CustomerRow[]) {
  const buckets = new Map<RfmSegmentId, { customers: number; turnover: number; orders: number }>();
  segmentOrder.forEach((id) => buckets.set(id, { customers: 0, turnover: 0, orders: 0 }));
  rows.forEach((row) => { const bucket = buckets.get(segmentFor(row))!; bucket.customers++; bucket.orders += Number(row.orders); bucket.turnover += Number(row.turnover); });
  return { buckets, segments: segmentOrder.map((id) => { const bucket = buckets.get(id)!; return { ...meta[id], customers: bucket.customers, turnover: bucket.turnover, averageCheck: bucket.orders ? bucket.turnover / bucket.orders : 0 }; }) };
}

export async function getRfmReport(days: number): Promise<RfmReport> {
  const { normalizedDays, from, to } = period(days);
  const rows = await withMarketingSource((client) => loadCachedCustomers(client, from, to));
  const { buckets, segments } = makeSegments(rows); const orders = rows.reduce((sum, row) => sum + Number(row.orders), 0); const turnover = rows.reduce((sum, row) => sum + Number(row.turnover), 0); const champions = buckets.get('champions')!, atRisk = buckets.get('at_risk')!;
  return { generatedAt: new Date().toISOString(), period: { from, to, days: normalizedDays }, totals: { customers: rows.length, orders, turnover, averageCheck: orders ? turnover / orders : 0 }, segments, recommendations: [champions.customers ? `Збережіть «Чемпіонів»: персональні пропозиції та ранній доступ до акцій для ${number(champions.customers)} покупців.` : 'У вибраному періоді не знайдено достатньо даних для сегмента «Чемпіони».', atRisk.customers ? `Запустіть win-back кампанію для «Під ризиком»: ${number(atRisk.customers)} покупців.` : 'Сегмент «Під ризиком» поки що порожній.', 'Перед запуском кампанії перевіряйте маржинальність товарів і не трактуйте цей звіт як причинний ефект акції.'] };
}

export async function getRfmSegmentDetail(days: number, segmentId: string): Promise<RfmSegmentDetail> {
  if (!segmentOrder.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.');
  const id = segmentId as RfmSegmentId; const { from, to } = period(days);
  return withMarketingSource(async (client) => {
    const allCustomers = await loadCachedCustomers(client, from, to);
    const selectedCustomers = allCustomers.filter((row) => segmentFor(row) === id);
    if (!selectedCustomers.length) throw new Error('У цьому сегменті немає покупців за вибраний період.');
    const customerIds = selectedCustomers.map((row) => Number(row.customer_id));
    const result = await client.query<DetailRow>(`
      WITH selected_orders AS (
        SELECT code_shop, id_workplace, code_order, code_client, date_order
        FROM pos.order_client
        WHERE date_order >= $1::date AND date_order < ($2::date + interval '1 day')
          AND COALESCE(sum_order, 0) > 0 AND code_client = ANY($3::int[])
      ), product_lines AS (
        SELECT o.code_client, o.code_shop, o.id_workplace, o.code_order, w.code_wares::text AS code,
          COALESCE(NULLIF(TRIM(p.name_wares), ''), 'Товар #' || w.code_wares::text) AS name, NULLIF(w.barcode, '') AS barcode
        FROM selected_orders o JOIN pos.wares_order w USING (code_shop, id_workplace, code_order)
        LEFT JOIN pos.wares p ON p.code_wares = w.code_wares WHERE COALESCE(w.quantity, 0) > 0
      ) SELECT
        (SELECT MAX(date_order)::date::text FROM selected_orders) AS latest_visit,
        NULL::text AS weekday, NULL::text AS hour,
        (SELECT COUNT(*)::text FROM selected_orders) AS orders,
        COALESCE((SELECT json_agg(x) FROM (SELECT code, name, MIN(barcode) AS barcode, COUNT(DISTINCT code_client)::text AS customers, COUNT(DISTINCT (code_shop, id_workplace, code_order))::text AS orders FROM product_lines GROUP BY code, name ORDER BY COUNT(DISTINCT code_client) DESC LIMIT 10) x), '[]'::json) AS products
    `, [from, to, customerIds]);
    const stats = result.rows[0]; const orders = Number(stats.orders); const turnover = selectedCustomers.reduce((sum, row) => sum + Number(row.turnover), 0); const recency = selectedCustomers.reduce((sum, row) => sum + Number(row.recency_days), 0) / selectedCustomers.length;
    const behaviorRows = await client.query<{ weekday: string; hour: string; orders: string }>(`
      SELECT EXTRACT(DOW FROM date_order)::int::text AS weekday, EXTRACT(HOUR FROM date_order)::int::text AS hour, COUNT(*)::text AS orders
      FROM pos.order_client WHERE date_order >= $1::date AND date_order < ($2::date + interval '1 day')
        AND COALESCE(sum_order, 0) > 0 AND code_client = ANY($3::int[]) GROUP BY 1, 2`, [from, to, customerIds]);
    const distribution = weekdays.map((label, weekday) => ({ label, share: orders ? behaviorRows.rows.filter((row) => Number(row.weekday) === weekday).reduce((sum, row) => sum + Number(row.orders), 0) / orders * 100 : 0 }));
    const topHours = Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2, '0')}:00`, share: orders ? behaviorRows.rows.filter((row) => Number(row.hour) === hour).reduce((sum, row) => sum + Number(row.orders), 0) / orders * 100 : 0 })).sort((a, b) => b.share - a.share).slice(0, 3);
    const busiestWeekday = distribution.reduce((best, item) => item.share > best.share ? item : best, distribution[0]); const topProduct = stats.products[0]; const recovery = ['at_risk', 'need_attention', 'about_to_sleep', 'lost'].includes(id);
    return { segment: { ...meta[id], customers: selectedCustomers.length, turnover, averageCheck: orders ? turnover / orders : 0 }, behavior: { orders, ordersPerCustomer: orders / selectedCustomers.length, averageRecencyDays: recency, latestVisit: stats.latest_visit, averageLifetimeValue: turnover / selectedCustomers.length, totalLifetimeValue: turnover, busiestWeekday: busiestWeekday.label, busiestHour: topHours[0]?.label ?? null, weekdayDistribution: distribution, topHours }, topProducts: stats.products.map((product) => ({ ...product, customers: Number(product.customers), orders: Number(product.orders), reach: Number(product.customers) / selectedCustomers.length * 100 })), recommendation: recovery ? { trigger: `${number(selectedCustomers.length)} покупців цього сегмента мають середню давність ${Math.round(recency)} днів.`, action: `Повернення: персональне повідомлення у ${busiestWeekday.label} близько ${topHours[0]?.label ?? 'пікового часу'}.`, offer: topProduct ? `Почніть із релевантного товару: «${topProduct.name}».` : 'Почніть із персонального опитування причини відтоку.', warning: 'Не оцінюйте кампанію без контрольної групи; знижку застосовуйте лише там, де вона виправдана маржею.' } : { trigger: `${number(selectedCustomers.length)} покупців сегмента мають середню давність ${Math.round(recency)} днів.`, action: `Утримання: комунікація у ${busiestWeekday.label} близько ${topHours[0]?.label ?? 'пікового часу'} через цінність, а не масову знижку.`, offer: topProduct ? `Дайте ранній доступ або крос-пропозицію навколо «${topProduct.name}».` : 'Дайте ранній доступ до новинок.', warning: 'Не девальвуйте лояльність постійними знижками для покупців, які й так активно купують.' } };
  });
}
