import { withMarketingSource } from '@/lib/marketing-source-db';

export type RfmSegmentId =
  | 'champions'
  | 'loyal'
  | 'potential_loyalists'
  | 'new_customers'
  | 'at_risk'
  | 'need_attention'
  | 'about_to_sleep'
  | 'lost';

export type RfmSegment = {
  id: RfmSegmentId;
  label: string;
  description: string;
  customers: number;
  turnover: number;
  averageCheck: number;
};

export type RfmReport = {
  generatedAt: string;
  period: { from: string; to: string; days: number };
  totals: { customers: number; orders: number; turnover: number; averageCheck: number };
  segments: RfmSegment[];
  recommendations: string[];
};

export type RfmSegmentDetail = {
  segment: RfmSegment;
  behavior: {
    orders: number;
    ordersPerCustomer: number;
    averageRecencyDays: number;
    latestVisit: string | null;
    averageLifetimeValue: number;
    totalLifetimeValue: number;
    busiestWeekday: string | null;
    busiestHour: string | null;
    weekdayDistribution: Array<{ label: string; share: number }>;
    topHours: Array<{ label: string; share: number }>;
  };
  topProducts: Array<{ code: string; name: string; barcode: string | null; customers: number; orders: number; reach: number }>;
  recommendation: { trigger: string; action: string; offer: string; warning: string };
};

type CustomerRow = {
  customer_id: string;
  orders: string;
  turnover: string;
  recency_days: string;
  r_score: string;
  f_score: string;
  m_score: string;
};

const segmentMeta: Record<RfmSegmentId, Omit<RfmSegment, 'customers' | 'turnover' | 'averageCheck'>> = {
  champions: { id: 'champions', label: 'Чемпіони', description: 'Найцінніші та найактивніші покупці.' },
  loyal: { id: 'loyal', label: 'Лояльні', description: 'Регулярно повертаються та формують стабільний оборот.' },
  potential_loyalists: { id: 'potential_loyalists', label: 'Потенційно лояльні', description: 'Недавні покупці з потенціалом для розвитку звички.' },
  new_customers: { id: 'new_customers', label: 'Нові', description: 'Зробили недавню першу або одиничну покупку.' },
  at_risk: { id: 'at_risk', label: 'Під ризиком', description: 'Раніше були цінними, але давно не поверталися.' },
  need_attention: { id: 'need_attention', label: 'Потребують уваги', description: 'Активність знижується; варто повернути інтерес.' },
  about_to_sleep: { id: 'about_to_sleep', label: 'Засинають', description: 'Низька частота і давня остання покупка.' },
  lost: { id: 'lost', label: 'Втрачені', description: 'Найнижча поточна ймовірність повернення.' }
};

const segmentOrder: RfmSegmentId[] = ['champions', 'loyal', 'potential_loyalists', 'new_customers', 'at_risk', 'need_attention', 'about_to_sleep', 'lost'];

const segmentSql = `
  CASE
    WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4 THEN 'champions'
    WHEN r_score >= 3 AND f_score >= 3 THEN 'loyal'
    WHEN r_score >= 4 AND f_score >= 2 THEN 'potential_loyalists'
    WHEN r_score >= 4 AND f_score = 1 THEN 'new_customers'
    WHEN r_score <= 2 AND f_score >= 3 AND m_score >= 3 THEN 'at_risk'
    WHEN r_score <= 3 AND f_score >= 2 THEN 'need_attention'
    WHEN r_score <= 2 AND f_score = 1 THEN 'about_to_sleep'
    ELSE 'lost'
  END`;

function segmentFor(row: CustomerRow): RfmSegmentId {
  const r = Number(row.r_score);
  const f = Number(row.f_score);
  const m = Number(row.m_score);
  if (r >= 4 && f >= 4 && m >= 4) return 'champions';
  if (r >= 3 && f >= 3) return 'loyal';
  if (r >= 4 && f >= 2) return 'potential_loyalists';
  if (r >= 4 && f === 1) return 'new_customers';
  if (r <= 2 && f >= 3 && m >= 3) return 'at_risk';
  if (r <= 3 && f >= 2) return 'need_attention';
  if (r <= 2 && f === 1) return 'about_to_sleep';
  return 'lost';
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getPeriod(days: number) {
  const normalizedDays = days === 90 ? 90 : days === 365 ? 365 : 180;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - normalizedDays + 1);
  return { normalizedDays, from: dateOnly(start), to: dateOnly(end) };
}

export async function getRfmReport(days: number): Promise<RfmReport> {
  const { normalizedDays, from, to } = getPeriod(days);

  const rows = await withMarketingSource(async (client) => {
    const result = await client.query<CustomerRow>(`
      WITH customer_metrics AS (
        SELECT
          code_client::text AS customer_id,
          COUNT(*)::bigint AS orders,
          SUM(COALESCE(sum_order, 0))::numeric AS turnover,
          (CURRENT_DATE - MAX(date_order)::date)::int AS recency_days
        FROM pos.order_client
        WHERE date_order >= $1::date
          AND date_order < ($2::date + interval '1 day')
          AND code_client IS NOT NULL
          AND code_client <> 0
          AND COALESCE(sum_order, 0) > 0
        GROUP BY code_client
      )
      SELECT
        customer_id,
        orders::text,
        turnover::text,
        recency_days::text,
        NTILE(5) OVER (ORDER BY recency_days DESC)::text AS r_score,
        NTILE(5) OVER (ORDER BY orders ASC)::text AS f_score,
        NTILE(5) OVER (ORDER BY turnover ASC)::text AS m_score
      FROM customer_metrics
    `, [from, to]);
    return result.rows;
  });

  const buckets = new Map<RfmSegmentId, { customers: number; turnover: number; orders: number }>();
  for (const id of segmentOrder) buckets.set(id, { customers: 0, turnover: 0, orders: 0 });
  for (const row of rows) {
    const bucket = buckets.get(segmentFor(row))!;
    bucket.customers += 1;
    bucket.orders += Number(row.orders);
    bucket.turnover += Number(row.turnover);
  }

  const totalOrders = rows.reduce((sum, row) => sum + Number(row.orders), 0);
  const turnover = rows.reduce((sum, row) => sum + Number(row.turnover), 0);
  const segments = segmentOrder.map((id) => {
    const bucket = buckets.get(id)!;
    return {
      ...segmentMeta[id],
      customers: bucket.customers,
      turnover: bucket.turnover,
      averageCheck: bucket.orders ? bucket.turnover / bucket.orders : 0
    };
  });
  const champions = buckets.get('champions')!;
  const atRisk = buckets.get('at_risk')!;
  const atRiskTurnoverShare = turnover ? Math.round((atRisk.turnover / turnover) * 100) : 0;

  return {
    generatedAt: new Date().toISOString(),
    period: { from, to, days: normalizedDays },
    totals: {
      customers: rows.length,
      orders: totalOrders,
      turnover,
      averageCheck: totalOrders ? turnover / totalOrders : 0
    },
    segments,
    recommendations: [
      champions.customers
        ? `Збережіть «Чемпіонів»: персональні пропозиції та ранній доступ до акцій для ${champions.customers.toLocaleString('uk-UA')} покупців.`
        : 'У вибраному періоді не знайдено достатньо даних для сегмента «Чемпіони».',
      atRisk.customers
        ? `Запустіть окрему win-back кампанію для «Під ризиком»: це ${atRisk.customers.toLocaleString('uk-UA')} покупців і ${atRiskTurnoverShare}% обороту вибраного періоду.`
        : 'Сегмент «Під ризиком» поки що порожній.',
      'Перед запуском кампанії перевіряйте маржинальність товарів і не трактуйте цей звіт як причинний ефект акції.'
    ]
  };
}

type SegmentDetailRow = {
  summary: {
    customers: string; orders: string; turnover: string; average_recency_days: string;
    latest_visit: string | null; average_ltv: string; total_ltv: string;
  } | null;
  products: Array<{ code: string; name: string; barcode: string | null; customers: string; orders: string }>;
  weekdays: Array<{ weekday: string; orders: string }>;
  hours: Array<{ hour: string; orders: string }>;
};

const weekdayLabels = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export async function getRfmSegmentDetail(days: number, segmentId: string): Promise<RfmSegmentDetail> {
  if (!segmentOrder.includes(segmentId as RfmSegmentId)) throw new Error('Невідомий RFM-сегмент.');
  const id = segmentId as RfmSegmentId;
  const { from, to } = getPeriod(days);
  const rows = await withMarketingSource(async (client) => {
    const result = await client.query<SegmentDetailRow>(`
      WITH customer_metrics AS (
        SELECT code_client::text AS customer_id, COUNT(*)::bigint AS orders,
          SUM(COALESCE(sum_order, 0))::numeric AS turnover,
          (CURRENT_DATE - MAX(date_order)::date)::int AS recency_days
        FROM pos.order_client
        WHERE date_order >= $1::date AND date_order < ($2::date + interval '1 day')
          AND code_client IS NOT NULL AND code_client <> 0 AND COALESCE(sum_order, 0) > 0
        GROUP BY code_client
      ), scored AS (
        SELECT *, NTILE(5) OVER (ORDER BY recency_days DESC) AS r_score,
          NTILE(5) OVER (ORDER BY orders ASC) AS f_score,
          NTILE(5) OVER (ORDER BY turnover ASC) AS m_score
        FROM customer_metrics
      ), segment_customers AS (
        SELECT customer_id, orders, turnover, recency_days FROM scored WHERE ${segmentSql} = $3
      ), segment_orders AS (
        SELECT o.* FROM pos.order_client o
        JOIN segment_customers sc ON sc.customer_id = o.code_client::text
        WHERE o.date_order >= $1::date AND o.date_order < ($2::date + interval '1 day')
          AND COALESCE(o.sum_order, 0) > 0
      ), product_lines AS (
        SELECT o.code_client::text AS customer_id, o.code_shop, o.id_workplace, o.code_order,
          w.code_wares::text AS code, COALESCE(NULLIF(TRIM(p.name_wares), ''), 'Товар #' || w.code_wares::text) AS name,
          NULLIF(w.barcode, '') AS barcode
        FROM segment_orders o
        JOIN pos.wares_order w USING (code_shop, id_workplace, code_order)
        LEFT JOIN pos.wares p ON p.code_wares = w.code_wares
        WHERE COALESCE(w.quantity, 0) > 0
      ), lifetime AS (
        SELECT sc.customer_id, SUM(COALESCE(o.sum_order, 0)) AS ltv
        FROM segment_customers sc JOIN pos.order_client o ON o.code_client::text = sc.customer_id
        WHERE COALESCE(o.sum_order, 0) > 0 GROUP BY sc.customer_id
      )
      SELECT
        (SELECT json_build_object(
          'customers', COUNT(*)::text, 'orders', COALESCE(SUM(orders), 0)::text,
          'turnover', COALESCE(SUM(turnover), 0)::text, 'average_recency_days', COALESCE(AVG(recency_days), 0)::text,
          'latest_visit', (SELECT MAX(date_order)::date::text FROM segment_orders),
          'average_ltv', COALESCE((SELECT AVG(ltv) FROM lifetime), 0)::text,
          'total_ltv', COALESCE((SELECT SUM(ltv) FROM lifetime), 0)::text
        ) FROM segment_customers) AS summary,
        COALESCE((SELECT json_agg(product_row ORDER BY product_row.customers::bigint DESC, product_row.orders::bigint DESC)
          FROM (SELECT code, name, MIN(barcode) AS barcode, COUNT(DISTINCT customer_id)::text AS customers,
            COUNT(DISTINCT (code_shop, id_workplace, code_order))::text AS orders
            FROM product_lines GROUP BY code, name ORDER BY COUNT(DISTINCT customer_id) DESC LIMIT 10) product_row), '[]'::json) AS products,
        COALESCE((SELECT json_agg(weekday_row ORDER BY weekday_row.weekday::int)
          FROM (SELECT EXTRACT(DOW FROM date_order)::int::text AS weekday, COUNT(*)::text AS orders FROM segment_orders GROUP BY 1) weekday_row), '[]'::json) AS weekdays,
        COALESCE((SELECT json_agg(hour_row ORDER BY hour_row.hour::int)
          FROM (SELECT EXTRACT(HOUR FROM date_order)::int::text AS hour, COUNT(*)::text AS orders FROM segment_orders GROUP BY 1) hour_row), '[]'::json) AS hours
    `, [from, to, id]);
    return result.rows;
  });
  const data = rows[0];
  if (!data?.summary || Number(data.summary.customers) === 0) throw new Error('У цьому сегменті немає покупців за вибраний період.');
  const customers = Number(data.summary.customers);
  const orders = Number(data.summary.orders);
  const turnover = Number(data.summary.turnover);
  const weekdayDistribution = weekdayLabels.map((label, weekday) => {
    const found = data.weekdays.find((item) => Number(item.weekday) === weekday);
    return { label, share: orders ? (Number(found?.orders ?? 0) / orders) * 100 : 0 };
  });
  const topHours = data.hours
    .map((item) => ({ label: `${String(Number(item.hour)).padStart(2, '0')}:00`, share: orders ? (Number(item.orders) / orders) * 100 : 0 }))
    .sort((a, b) => b.share - a.share).slice(0, 3);
  const busiestWeekday = weekdayDistribution.reduce((best, item) => item.share > (best?.share ?? -1) ? item : best, weekdayDistribution[0]);
  const topProduct = data.products[0];
  const segment = {
    ...segmentMeta[id], customers, turnover, averageCheck: orders ? turnover / orders : 0
  };
  const winBack = id === 'at_risk' || id === 'about_to_sleep' || id === 'lost' || id === 'need_attention';
  return {
    segment,
    behavior: {
      orders, ordersPerCustomer: orders / customers, averageRecencyDays: Number(data.summary.average_recency_days),
      latestVisit: data.summary.latest_visit, averageLifetimeValue: Number(data.summary.average_ltv), totalLifetimeValue: Number(data.summary.total_ltv),
      busiestWeekday: busiestWeekday?.label ?? null, busiestHour: topHours[0]?.label ?? null, weekdayDistribution, topHours
    },
    topProducts: data.products.map((product) => ({ ...product, customers: Number(product.customers), orders: Number(product.orders), reach: (Number(product.customers) / customers) * 100 })),
    recommendation: winBack ? {
      trigger: `${number(customers)} покупців цього сегмента мають середню давність ${Math.round(Number(data.summary.average_recency_days))} днів.`,
      action: `Повернення: персональне повідомлення у ${busiestWeekday?.label ?? 'пік активності'} близько ${topHours[0]?.label ?? 'часу покупки'}.`,
      offer: topProduct ? `Почніть із релевантного товару: «${topProduct.name}».` : 'Почніть із персонального опитування причини відтоку.',
      warning: 'Не оцінюйте кампанію без контрольної групи; знижку застосовуйте лише там, де вона виправдана маржею.'
    } : {
      trigger: `${number(customers)} покупців сегмента мають середню давність ${Math.round(Number(data.summary.average_recency_days))} днів.`,
      action: `Утримання: комунікація у ${busiestWeekday?.label ?? 'пік активності'} близько ${topHours[0]?.label ?? 'часу покупки'} через цінність, а не масову знижку.`,
      offer: topProduct ? `Дайте ранній доступ або крос-пропозицію навколо «${topProduct.name}».` : 'Дайте ранній доступ до новинок.',
      warning: 'Не девальвуйте лояльність постійними знижками для покупців, які й так активно купують.'
    }
  };
}

function number(value: number): string {
  return value.toLocaleString('uk-UA');
}
