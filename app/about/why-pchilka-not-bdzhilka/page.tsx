import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

type StoryContent = {
  title: string;
  paragraphs: string[];
};

export const metadata: Metadata = {
  title: 'Чому Пчілка не Бджілка | Pchilka Market',
  description: 'Історія назви Pchilka Market: чому мережа обрала назву Пчілка та як сформувалася ідентичність бренду.'
};

async function readStoryContent(): Promise<StoryContent | null> {
  const filePath = path.join(process.cwd(), 'public', 'info', 'chomu-pchilka-ne-bdzhilka.txt');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return null;

    const [title, ...paragraphs] = lines;
    return {
      title,
      paragraphs
    };
  } catch {
    return null;
  }
}

export default async function WhyPchilkaNotBdzhilkaPage() {
  const story = await readStoryContent();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-brand/25 bg-white/95 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Про мережу</p>

        {story ? (
          <>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">{story.title}</h1>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-800">
              {story.paragraphs.map((paragraph, index) => (
                <p key={`${index}_${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Текст сторінки поки що не знайдено у файлі <span className="font-semibold">public/info/chomu-pchilka-ne-bdzhilka.txt</span>.
          </p>
        )}
      </section>
    </main>
  );
}
