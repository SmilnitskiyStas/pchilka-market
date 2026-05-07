import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import type { ReactNode } from 'react';

import CooperationMarketingServicesForm from '@/components/cooperation-marketing-services-form';

type MarketingContent = {
  lines: string[];
};

export const metadata: Metadata = {
  title: 'Надаємо маркетингові послуги | Pchilka Market',
  description:
    'Сторінка співпраці Pchilka Market: маркетингові можливості мережі та форма подачі запиту на розміщення.'
};

async function readMarketingContent(): Promise<MarketingContent | null> {
  const filePath = path.join(process.cwd(), 'public', 'img', 'cooperation', 'marketing_services.txt');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return null;
    return { lines };
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
      if (start > lastIndex) elements.push(line.slice(lastIndex, start));

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

    if (lastIndex < line.length) elements.push(line.slice(lastIndex));

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

export default async function MarketingServicesPage() {
  const content = await readMarketingContent();
  const securityNoticeLine = content?.lines.find((line) => /Служби безпеки/i.test(line)) ?? null;
  const baseLines = content?.lines.filter((line) => !/Служби безпеки/i.test(line)) ?? [];
  const introLines = baseLines.slice(0, 3);
  const contactLines = baseLines.slice(3);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Співпраця</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Надаємо маркетингові послуги</h1>

        {content ? (
          <>
            <div className="mt-6 space-y-3">{introLines.map((line, index) => contentLineToNode(line, index))}</div>

            {contactLines.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {contactLines.map((line, index) => contentLineToNode(line, 100 + index))}
              </div>
            ) : null}

            {securityNoticeLine ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {contentLineToNode(securityNoticeLine, 200)}
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Текст сторінки поки що не знайдено у файлі{' '}
            <span className="font-semibold">public/img/cooperation/marketing_services.txt</span>.
          </p>
        )}

        <CooperationMarketingServicesForm />
      </section>
    </main>
  );
}
