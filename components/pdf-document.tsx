import { isPdfDocumentUrl } from '@/lib/pdf-document';

export default function PdfDocument({ src, title = 'PDF-документ' }: { src: string; title?: string }) {
  if (!isPdfDocumentUrl(src)) return null;
  const label = title.trim() || 'PDF-документ';
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" aria-label={label}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-words font-semibold text-slate-900">{label}</h3><a href={src} target="_blank" rel="noopener noreferrer" className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand">Відкрити PDF ↗</a></div>
    <iframe src={src} title={label} loading="lazy" className="h-[70vh] min-h-[360px] max-h-[800px] w-full rounded-xl border border-slate-200" />
    <p className="text-xs text-slate-500">Якщо документ не відображається, натисніть «Відкрити PDF».</p>
  </section>;
}
