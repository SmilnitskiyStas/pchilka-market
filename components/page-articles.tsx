import type { ContentEntry } from '@/lib/content-entries';
import ArticleBody from '@/components/article-body';

export default function PageArticles({ articles }: { articles: ContentEntry[] }) {
  return <div className="space-y-6">
    {articles.map((entry) => <article id={`article-${entry.slug}`} key={entry.id} className="scroll-mt-28 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {entry.coverImage ? <img src={entry.coverImage} alt={entry.title} className="max-h-96 w-full object-cover" /> : null}
      <div className="space-y-6 p-6 sm:p-8">
        {entry.excerpt ? <p className="text-slate-600">{entry.excerpt}</p> : null}
        <div className="[&>div]:mt-0"><ArticleBody body={entry.body} /></div>
      </div>
    </article>)}
  </div>;
}
