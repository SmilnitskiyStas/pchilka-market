import type { ContentEntry } from '@/lib/content-entries';
import ArticleBody from '@/components/article-body';

export default function PageArticles({ articles }: { articles: ContentEntry[] }) {
  return <div className="space-y-6">
    {articles.map((entry) => <article id={`article-${entry.slug}`} key={entry.id} className="scroll-mt-28 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {entry.coverImage ? <img src={entry.coverImage} alt={entry.title} className="max-h-96 w-full object-cover" /> : null}
      <div className="p-6 sm:p-8"><h2 className="text-3xl font-bold text-slate-900">{entry.title}</h2>{entry.excerpt ? <p className="mt-3 text-slate-600">{entry.excerpt}</p> : null}<ArticleBody body={entry.body} /></div>
    </article>)}
  </div>;
}
