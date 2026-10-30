import { getYouTubeEmbedUrl, isYouTubeUrl } from '@/lib/youtube-video';
import { isSafePageUrl, type VisualPage } from '@/lib/visual-pages';
import PdfDocument from '@/components/pdf-document';
import VisualRichText from '@/components/visual-rich-text';
import CooperationRentalForm from '@/components/cooperation-rental-form';

function VideoBlock({ src, title }: { src: string; title: string }) {
  src = src.trim();
  if (!isSafePageUrl(src)) return null;
  const embed = getYouTubeEmbedUrl(src);
  if (embed) return <iframe src={embed} title={title || 'Відео YouTube'} loading="lazy" className="aspect-video min-h-[200px] w-full rounded-2xl border-0" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />;
  if (isYouTubeUrl(src)) return null;
  return <video controls preload="metadata" aria-label={title || 'Відео'} className="w-full rounded-2xl" src={src} />;
}

export default function VisualPageBody({ page, selectedBlockId, editing = false }: { page: VisualPage; selectedBlockId?: string; editing?: boolean }) {
  return <article className="visual-page rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-sm"><div className="visual-page-content space-y-6">
    <h1 className="visual-page-title break-words font-bold">{page.title || 'Назва сторінки'}</h1>
    {page.blocks.map((block) => <div key={block.id} id={`block-${block.id}`} data-page-block={block.id} className={`scroll-mt-28 break-words ${selectedBlockId === block.id ? 'rounded-lg outline outline-2 outline-offset-4 outline-brand' : ''}`}>
      {block.type === 'heading' ? <h2 className="text-2xl font-bold">{block.text}</h2> : null}
      {block.type === 'text' ? <VisualRichText text={block.text} /> : null}
      {block.type === 'columns' ? <div className="visual-page-columns"><VisualRichText text={block.left} /><VisualRichText text={block.right} /></div> : null}
      {block.type === 'banner' ? <section className="overflow-hidden rounded-2xl bg-brand/10">
        {isSafePageUrl(block.src) ? <img src={block.src} alt="" className="max-h-80 w-full object-cover" /> : null}
        <div className="space-y-4 p-5"><h2 className="text-2xl font-bold">{block.title}</h2><VisualRichText text={block.text} />
          {block.label && isSafePageUrl(block.href) ? <a href={block.href} className="inline-block rounded-full bg-brand px-5 py-3 font-semibold text-white">{block.label}</a> : null}
        </div>
      </section> : null}
      {block.type === 'pdf' ? <PdfDocument src={block.src} title={block.title} /> : null}
      {block.type === 'video' ? <VideoBlock src={block.src} title={block.title} /> : null}
      {block.type === 'form' ? editing ? <div className="rounded-2xl border-2 border-dashed border-brand/40 bg-slate-50 p-6"><h2 className="text-xl font-semibold">Форма запиту на оренду</h2><p className="mt-2 text-sm text-slate-600">Контакти, мета оренди, повідомлення та вкладення. На опублікованій сторінці відвідувач зможе надіслати запит.</p></div> : <CooperationRentalForm /> : null}
      {block.type === 'image' && isSafePageUrl(block.src) ? <figure><img src={block.src} alt={block.alt} className="mx-auto h-auto max-w-full rounded-2xl" /></figure> : null}
      {block.type === 'button' && isSafePageUrl(block.href) ? <a href={block.href} className="inline-block rounded-full bg-brand px-6 py-3 font-semibold text-white">{block.label}</a> : null}
    </div>)}
  </div></article>;
}
