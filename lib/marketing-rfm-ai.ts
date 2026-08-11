import type { RfmReport, RfmSegmentBehavior, RfmSegmentDetail, RfmSegmentTopProduct } from '@/lib/marketing-rfm';
import { getRfmAiConnection } from '@/lib/integrations-repository';

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

function outputText(response: OpenAiResponse): string {
  if (response.output_text?.trim()) return response.output_text.trim();
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text!)
    .join('\n')
    .trim() ?? '';
}

export async function getRfmAiAdvice(input: {
  report: RfmReport;
  storeName?: string;
  detail?: RfmSegmentDetail;
  behavior?: RfmSegmentBehavior;
  products?: RfmSegmentTopProduct[];
  question?: string;
}): Promise<string> {
  const connection = await getRfmAiConnection();
  if (!connection.enabled) throw new Error('AI-помічник вимкнений у «Інтеграціях».');
  if (!connection.apiKey) throw new Error('Додайте AI API key у «Інтеграціях».');

  const context = {
    store: input.storeName ?? 'Уся мережа',
    period: input.report.period,
    totals: input.report.totals,
    segments: input.report.segments.map(({ id, label, customers, turnover, averageCheck }) => ({ id, label, customers, turnover, averageCheck })),
    selectedSegment: input.detail ? {
      segment: input.detail.segment,
      behavior: input.detail.behavior,
      recommendation: input.detail.recommendation,
      purchaseBehavior: input.behavior,
      topProducts: input.products?.slice(0, 10)
    } : undefined
  };

  const prompt = [
    'Ти — AI-маркетолог мережі магазинів. Аналізуй лише передані агреговані RFM-дані.',
    'Відповідай українською. Не вигадуй даних, не пропонуй масові знижки без тесту, не давай персональних порад окремим клієнтам.',
    'Сформуй короткий практичний план у Markdown: спочатку «Висновок» (1–2 речення), далі «Пріоритетні дії» (до 4 нумерованих кроків), «Тест на 2–4 тижні» і «Ризики та контроль». Для кожної дії вкажи цільовий сегмент, канал/час за наявності даних, офер і метрику успіху. Наголоси, що результат кампанії слід порівнювати з контрольною групою.',
    `Дані: ${JSON.stringify(context)}`,
    input.question ? `Запит маркетолога: ${input.question.slice(0, 800)}` : ''
  ].filter(Boolean).join('\n\n');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${connection.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: connection.model,
      input: prompt,
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' },
      max_output_tokens: 900,
      store: false
    }),
    signal: AbortSignal.timeout(45_000)
  });
  const payload = await response.json().catch(() => ({})) as OpenAiResponse;
  if (!response.ok) throw new Error(payload.error?.message || 'Не вдалося отримати відповідь AI-помічника.');
  const advice = outputText(payload);
  if (!advice) throw new Error('AI-помічник повернув порожню відповідь. Спробуйте ще раз.');
  return advice;
}
