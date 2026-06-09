import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import type { ReactNode } from 'react';

import CooperationOfferForm from '@/components/cooperation-offer-form';

type ManagerCategory = {
  category: string;
  managerName?: string;
  email: string;
};

type CooperationContent = {
  title: string;
  introLines: string[];
  managerCategories: ManagerCategory[];
  securityNotice: string | null;
};

export const metadata: Metadata = {
  title: 'Запропонувати товар | Pchilka Market',
  description: 'Сторінка співпраці Pchilka Market: пропозиція товару та форма для звернення.'
};

async function readCooperationContent(): Promise<CooperationContent | null> {
  const filePath = path.join(process.cwd(), 'public', 'img', 'cooperation', 'offer_product.txt');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const title = (lines[0] ?? '').trim();

    if (!title) return null;

    const contentLines = lines.slice(1);
    const managerStartIndex = contentLines.findIndex((line) =>
      line.trim().toLowerCase().startsWith('маєте що запропонувати?')
    );

    const introLines =
      managerStartIndex >= 0
        ? contentLines
            .slice(0, managerStartIndex + 1)
            .map((line) => line.trim())
            .filter(Boolean)
        : contentLines.map((line) => line.trim()).filter(Boolean);

    const managerRawLines = managerStartIndex >= 0 ? contentLines.slice(managerStartIndex + 1) : [];
    const managerBlocks: string[][] = [];
    let currentBlock: string[] = [];

    for (const line of managerRawLines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentBlock.length > 0) {
          managerBlocks.push(currentBlock);
          currentBlock = [];
        }
        continue;
      }
      currentBlock.push(trimmed);
    }
    if (currentBlock.length > 0) {
      managerBlocks.push(currentBlock);
    }

    const managerCategories: ManagerCategory[] = [];
    let securityNotice: string | null = null;

    managerBlocks.forEach((block) => {
      const emailLine = block.find((line) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line));
      if (!emailLine) return;

      const emailMatch = emailLine.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (!emailMatch) return;
      const email = emailMatch[0];

      if (block.length === 1) {
        securityNotice = block[0];
        return;
      }

      const nonEmailLines = block.filter((line) => !line.includes(email));
      if (nonEmailLines.length === 0) return;

      const category = nonEmailLines[0];
      const managerName = nonEmailLines.length > 1 ? nonEmailLines[1] : undefined;
      managerCategories.push({ category, managerName, email });
    });

    return { title, introLines, managerCategories, securityNotice };
  } catch {
    return null;
  }
}

function contentLineToNode(line: string, index: number) {
  const emailMatch = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);

  if (emailMatch && emailMatch.length > 0) {
    const elements: ReactNode[] = [];
    let lastIndex = 0;

    emailMatch.forEach((email, emailIndex) => {
      const start = line.indexOf(email, lastIndex);
      if (start > lastIndex) {
        elements.push(line.slice(lastIndex, start));
      }

      elements.push(
        <a
          key={`${index}_${email}_${emailIndex}`}
          href={`mailto:${email}`}
          className="font-semibold text-brand hover:underline"
        >
          {email}
        </a>
      );

      lastIndex = start + email.length;
    });

    if (lastIndex < line.length) {
      elements.push(line.slice(lastIndex));
    }

    return (
      <p key={`${index}_${line.slice(0, 16)}`} className="text-base leading-relaxed text-slate-800">
        {elements}
      </p>
    );
  }

  return (
    <p key={`${index}_${line.slice(0, 16)}`} className="text-base leading-relaxed text-slate-800">
      {line}
    </p>
  );
}

export default async function OfferProductPage() {
  const content = await readCooperationContent();
  const categoryOptions =
    content?.managerCategories.map((item) => ({
      label: item.category,
      recipientEmail: item.email,
      managerName: item.managerName
    })) ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Співпраця</p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          {content?.title ?? 'Запропонувати товар'}
        </h1>

        {content ? (
          <>
            <div className="mt-6 space-y-3">{content.introLines.map((line, index) => contentLineToNode(line, index))}</div>

            {content.managerCategories.length > 0 ? (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Контакти менеджерів за категоріями</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {content.managerCategories.map((item) => (
                    <article
                      key={`${item.category}_${item.email}`}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:shadow-lg"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand/40 bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
                            <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 1-1.5 2.3V17a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2v-6.2A2.5 2.5 0 0 1 3 8.5V7Zm2 0v1h14V7H5Zm1.5 3v7h11v-7h-11Zm2 1.5h7v1.5h-7V11.5Z" />
                          </svg>
                        </span>
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">Категорія</p>
                          <p className="mt-1 text-base font-semibold leading-snug text-slate-900">{item.category}</p>
                        </div>
                      </div>
                      {item.managerName ? <p className="mt-3 text-sm text-slate-700">Менеджер: {item.managerName}</p> : null}
                      <a href={`mailto:${item.email}`} className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">
                        {item.email}
                      </a>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {content.securityNotice ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {contentLineToNode(content.securityNotice, 1000)}
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Текст сторінки поки що не знайдено у файлі{' '}
            <span className="font-semibold">public/img/cooperation/offer_product.txt</span>.
          </p>
        )}

        <CooperationOfferForm
          mode="product"
          productCategories={categoryOptions}
          storageKey="cooperation_offer_product_requests"
          submitButtonLabel="Сформувати лист"
        />
      </section>
    </main>
  );
}
