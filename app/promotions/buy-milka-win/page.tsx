import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';

type MilkaDocument = {
  name: string;
  url: string;
  updatedAt: string;
};

async function getMilkaDocument(): Promise<MilkaDocument | null> {
  const docsDir = path.join(process.cwd(), 'public', 'pdf', 'milka');

  let entries: Awaited<ReturnType<typeof fs.readdir>> = [];
  try {
    entries = await fs.readdir(docsDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const documents = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
      .map(async (entry) => {
        const absolutePath = path.join(docsDir, entry.name);
        const stats = await fs.stat(absolutePath);

        return {
          name: entry.name,
          url: `/pdf/milka/${encodeURIComponent(entry.name)}`,
          updatedAt: stats.mtime.toISOString()
        };
      })
  );

  if (documents.length === 0) return null;

  documents.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return documents[0];
}

export default async function BuyMilkaWinPage() {
  const document = await getMilkaDocument();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-4 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Акції</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Купуй Milka та вигравай</h1>
        <p className="mt-3 max-w-4xl text-sm text-slate-700 sm:text-base">
          На цій сторінці розміщено офіційний PDF-документ з умовами участі в розіграші, переліком товарів, що беруть участь в акції,
          та правилами отримання призів.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>Щоб взяти участь, перегляньте документ і виконайте кроки, зазначені в умовах акції.</p>
        </div>

        {document ? (
          <section className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Документ: <span className="font-semibold text-slate-900">{document.name}</span>
              </p>
              <Link
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Відкрити PDF в новій вкладці
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <iframe
                src={`${document.url}#view=FitH`}
                title="Документ акції Milka"
                className="h-[68vh] min-h-[420px] w-full sm:h-[74vh] sm:min-h-[560px] md:h-[85vh] md:min-h-[700px] lg:h-[90vh] lg:min-h-[920px]"
              />
            </div>
          </section>
        ) : (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            PDF-документ для акції Milka поки що не знайдено в папці <span className="font-semibold">public/pdf/milka</span>.
          </p>
        )}
      </section>
    </main>
  );
}


