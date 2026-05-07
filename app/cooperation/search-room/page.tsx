import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import type { ReactNode } from 'react';

import CooperationSearchRoomForm from '@/components/cooperation-search-room-form';

type SearchRoomContent = {
  lines: string[];
};

export const metadata: Metadata = {
  title: 'Шукаємо приміщення | Pchilka Market',
  description:
    'Сторінка співпраці Pchilka Market: вимоги до приміщення для нових магазинів та форма подання пропозиції.'
};

async function readSearchRoomContent(): Promise<SearchRoomContent | null> {
  const filePath = path.join(process.cwd(), 'public', 'img', 'cooperation', 'search_room.txt');

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

export default async function SearchRoomPage() {
  const content = await readSearchRoomContent();
  const securityLine = content?.lines.find((line) => /Служби безпеки/i.test(line)) ?? null;
  const baseLines = content?.lines.filter((line) => !/Служби безпеки/i.test(line)) ?? [];

  const introLine = baseLines[0] ?? null;
  const requirementLines = baseLines.slice(1, 5);
  const contactLines = baseLines.slice(5);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Співпраця</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Шукаємо приміщення</h1>

        {content ? (
          <>
            {introLine ? <p className="mt-5 text-base leading-relaxed text-slate-800">{introLine}</p> : null}

            {requirementLines.length > 0 ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {requirementLines.map((line, index) => (
                  <article
                    key={`${index}_${line.slice(0, 24)}`}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand/40 bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
                          <path d="M12 2a1 1 0 0 1 .8.4l2 2.6 3.2.8a1 1 0 0 1 .54 1.6l-2 2.4.2 3.3a1 1 0 0 1-1.45.94L12 12.8l-3.1 1.24a1 1 0 0 1-1.45-.94l.2-3.3-2-2.4a1 1 0 0 1 .54-1.6l3.2-.8 2-2.6A1 1 0 0 1 12 2Zm0 2.68-1.36 1.77a1 1 0 0 1-.55.37l-2.2.55 1.37 1.66c.16.2.24.45.22.71l-.14 2.3 2.17-.87a1 1 0 0 1 .74 0l2.17.87-.14-2.3a1 1 0 0 1 .22-.71l1.37-1.66-2.2-.55a1 1 0 0 1-.55-.37L12 4.68Z" />
                        </svg>
                      </span>
                      <p className="text-sm leading-relaxed text-slate-800">{line}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

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
            Текст сторінки поки що не знайдено у файлі <span className="font-semibold">public/img/cooperation/search_room.txt</span>.
          </p>
        )}

        <CooperationSearchRoomForm />
      </section>
    </main>
  );
}
