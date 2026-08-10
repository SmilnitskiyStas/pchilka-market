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

export async function getRfmReport(days: number): Promise<RfmReport> {
  const normalizedDays = days === 90 ? 90 : days === 365 ? 365 : 180;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - normalizedDays + 1);
  const from = dateOnly(start);
  const to = dateOnly(end);

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
