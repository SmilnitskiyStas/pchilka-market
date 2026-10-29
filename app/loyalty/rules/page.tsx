import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import PageArticles from '@/components/page-articles';
import { getBlogContentFromDb } from '@/lib/blog-content-repository';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Правила програми лояльності | Pchilka Market',
  description:
    'Офіційні правила участі у програмі лояльності Pchilka Market: нарахування, використання бонусів та обмеження.'
};

type RuleBlock =
  | { type: 'section'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'item'; marker: string; text: string }
  | { type: 'dash'; text: string };

function normalizeText(raw: string) {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '');
}

function isSectionTitle(line: string) {
  const compact = line.trim();
  if (!compact) return false;
  if (/^(\d+(?:\.\d+)*\.?|[—-])\s+/.test(compact)) return false;

  const words = compact.split(/\s+/).length;
  if (words > 8 || compact.length > 90) return false;

  if (/^[А-ЯІЇЄҐA-Z][^:;!?]*$/.test(compact) && !compact.includes('https://')) {
    if (compact.endsWith('.') && words > 4) return false;
    return true;
  }

  return false;
}

function parseRules(raw: string): RuleBlock[] {
  const lines = normalizeText(raw)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: RuleBlock[] = [];

  for (const line of lines) {
    const numbered = line.match(/^(\d+(?:\.\d+)*\.?)(?:\s+|$)(.*)$/);
    if (numbered) {
      const marker = numbered[1];
      const rest = numbered[2].trim();
      blocks.push({
        type: 'item',
        marker,
        text: rest.length > 0 ? rest : ' '
      });
      continue;
    }

    const dashed = line.match(/^[—-]\s*(.+)$/);
    if (dashed) {
      blocks.push({ type: 'dash', text: dashed[1].trim() });
      continue;
    }

    if (isSectionTitle(line)) {
      blocks.push({ type: 'section', text: line.replace(/[.]$/, '') });
      continue;
    }

    blocks.push({ type: 'paragraph', text: line });
  }

  return blocks;
}

async function readRulesBlocks(): Promise<RuleBlock[]> {
  const filePath = path.join(process.cwd(), 'public', 'img', 'loyalty_programm', 'program_rules.txt');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const blocks = parseRules(raw);
    return blocks;
  } catch {
    return [];
  }
}

export default async function LoyaltyRulesPage() {
  const content = await getBlogContentFromDb().catch(() => ({ entries: [] }));
  const articles = content.entries
    .filter((entry) => entry.pagePath === '/loyalty/rules' && entry.status === 'published')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const blocks = articles.length ? [] : await readRulesBlocks();

  return (
    <main className="site-container min-h-screen px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Програма лояльності</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Правила програми</h1>

        {articles.length ? <div className="mt-6"><PageArticles articles={articles} variant="inline" /></div> : blocks.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Правила програми лояльності поки що не опубліковані.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {blocks.map((block, index) => {
              if (block.type === 'section') {
                return (
                  <h2 key={`section_${index}`} className="pt-2 text-lg font-bold text-slate-900 sm:text-xl">
                    {block.text}
                  </h2>
                );
              }

              if (block.type === 'item') {
                return (
                  <div key={`item_${index}`} className="flex items-start gap-2 text-sm text-slate-700 sm:text-base">
                    <span className="min-w-[3.2rem] font-semibold text-slate-900">{block.marker}</span>
                    <p>{block.text}</p>
                  </div>
                );
              }

              if (block.type === 'dash') {
                return (
                  <div key={`dash_${index}`} className="flex items-start gap-2 text-sm text-slate-700 sm:text-base">
                    <span className="font-semibold text-slate-900">—</span>
                    <p>{block.text}</p>
                  </div>
                );
              }

              return (
                <p key={`paragraph_${index}`} className="text-sm leading-relaxed text-slate-700 sm:text-base">
                  {block.text}
                </p>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
