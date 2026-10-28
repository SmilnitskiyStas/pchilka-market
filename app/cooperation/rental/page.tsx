import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import type { ReactNode } from 'react';

import CooperationRentalForm from '@/components/cooperation-rental-form';
import rentalVisualContent from '@/components/rental-visual-content';
import PageArticles from '@/components/page-articles';
import { listPublishedFormEntries } from '@/lib/public-content-repository';
import { getVisualPage } from '@/lib/visual-pages-repository';

export const dynamic = 'force-dynamic';

type RentalContent = {
  title: string;
  lines: string[];
};

type RentalPageProps = { searchParams?: Promise<{ preview?: string }> };

const rentalMetadata: Metadata = {
  title: 'Пропонуємо в оренду | Pchilka Market',
  description: 'Сторінка співпраці Pchilka Market: пропозиція оренди площ і форма подання запиту.'
};

export async function generateMetadata({ searchParams }: RentalPageProps): Promise<Metadata> {
  const query = await searchParams;
  const page = (await getVisualPage('rental-intro').catch(() => null))?.published;
  const title = page?.seo?.title || rentalMetadata.title;
  return { ...rentalMetadata, metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://pchilka-market.ua'), title, description: page?.description || rentalMetadata.description,
    ...(page?.seo ? { other: { 'pchilka-visual-seo': 'true' } } : {}),
    alternates: { canonical: '/cooperation/rental' },
    ...(page?.seo?.image ? { openGraph: { images: [page.seo.image] }, twitter: { card: 'summary_large_image', images: [page.seo.image] } } : {}),
    ...(query?.preview || page?.seo?.noIndex ? { robots: { index: false, follow: false } } : {}) };
}

async function readRentalContent(): Promise<RentalContent | null> {
  const filePath = path.join(process.cwd(), 'public', 'img', 'cooperation', 'we_offer_rental.txt');

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
  const phoneMatch = line.match(/\+?\d[\d()\s-]{7,}\d/g);

  let output: ReactNode = line;

  if (emailMatch && emailMatch.length > 0) {
    const elements: ReactNode[] = [];
    let lastIndex = 0;
    emailMatch.forEach((email, emailIndex) => {
      const start = line.indexOf(email, lastIndex);
      if (start > lastIndex) elements.push(line.slice(lastIndex, start));
      elements.push(
        <a key={`email_${index}_${emailIndex}`} href={`mailto:${email}`} className="font-semibold text-brand hover:underline">
          {email}
        </a>
      );
      lastIndex = start + email.length;
    });
    if (lastIndex < line.length) elements.push(line.slice(lastIndex));
    output = elements;
  } else if (phoneMatch && phoneMatch.length > 0) {
    const phone = phoneMatch[0];
    const tel = phone.replace(/[^\d+]/g, '');
    output = (
      <a href={`tel:${tel}`} className="font-semibold text-brand hover:underline">
        {phone}
      </a>
    );
  }

  return (
    <p key={`${index}_${line.slice(0, 16)}`} className="text-base leading-relaxed text-slate-800">
      {output}
    </p>
  );
}

export default async function RentalPage({ searchParams }: RentalPageProps) {
  const query = await searchParams;
  const visual = await rentalVisualContent(query?.preview === '1');
  const articles = await listPublishedFormEntries('/cooperation/rental').catch(() => []);
  const content = await readRentalContent();
  const securityLine = content?.lines.find((line) => /Служби безпеки/i.test(line)) ?? null;
  const baseLines = content?.lines.filter((line) => !/Служби безпеки/i.test(line)) ?? [];

  const introLines = baseLines.slice(0, 2);
  const contactLines = baseLines.slice(2);

  return (
    <main className="site-container min-h-screen px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-5 shadow-sm sm:p-8">
        {visual.toolbar}
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Співпраця</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">{content?.title ?? 'Пропонуємо в оренду'}</h1>

        {content ? (
          <>
            <div className="mt-6 space-y-3">{introLines.map((line, index) => contentLineToNode(line, index))}</div>
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
        ) : null}

        {articles.length ? <div className="mt-6"><PageArticles articles={articles} /></div> : null}
        {visual.body}
        <CooperationRentalForm />
      </section>
    </main>
  );
}
