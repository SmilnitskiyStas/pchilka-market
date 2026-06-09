import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import type { ReactNode } from 'react';

import CooperationOfferForm from '@/components/cooperation-offer-form';

type CooperationContent = {
  title: string;
  lines: string[];
};

export const metadata: Metadata = {
  title: 'Запропонувати співпрацю | Pchilka Market',
  description: 'Сторінка співпраці Pchilka Market: інформація щодо пропозиції обладнання та форма для звернення.'
};

async function readCooperationContent(): Promise<CooperationContent | null> {
  const filePath = path.join(process.cwd(), 'public', 'img', 'cooperation', 'offer_equipment.txt');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return null;

    const [title, ...contentLines] = lines;
    return { title, lines: contentLines };
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

export default async function OfferEquipmentPage() {
  const content = await readCooperationContent();
  const securityLine = content?.lines.find((line) => /Служби безпеки/i.test(line)) ?? null;
  const baseLines = content?.lines.filter((line) => !/Служби безпеки/i.test(line)) ?? [];
  const emailLineIndex = baseLines.findIndex((line) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line));
  const contactStartIndex = emailLineIndex > 0 ? emailLineIndex - 1 : -1;
  const introLines = contactStartIndex >= 0 ? baseLines.slice(0, contactStartIndex) : baseLines;
  const contactLines = contactStartIndex >= 0 ? baseLines.slice(contactStartIndex) : [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Співпраця</p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          {content?.title ?? 'Запропонувати співпрацю'}
        </h1>

        {content ? (
          <>
            {introLines.length > 0 ? <div className="mt-6 space-y-3">{introLines.map((line, index) => contentLineToNode(line, index))}</div> : null}

            {contactLines.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {contactLines.map((line, index) => contentLineToNode(line, 100 + index))}
              </div>
            ) : null}

            {securityLine ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {contentLineToNode(securityLine, 200)}
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Текст сторінки поки що не знайдено у файлі{' '}
            <span className="font-semibold">public/img/cooperation/offer_equipment.txt</span>.
          </p>
        )}

        <CooperationOfferForm />
      </section>
    </main>
  );
}
