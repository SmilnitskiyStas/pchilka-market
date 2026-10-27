'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import CatalogFlipbook from '@/components/catalog-flipbook';

export type PromotionCatalog = {
  id: string;
  name: string;
  url: string;
  updatedAt: string;
  pageCount: number;
  title?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  pageImages?: string[];
};

type PromotionCatalogViewerProps = {
  catalogs: PromotionCatalog[];
  showArchive?: boolean;
};

function formatUpdatedAt(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

export default function PromotionCatalogViewer({ catalogs, showArchive = false }: PromotionCatalogViewerProps) {
  const [activeId, setActiveId] = useState(catalogs[0]?.id ?? '');
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(catalogs[0]?.pageCount ?? 1);
  const [isPreparing, setIsPreparing] = useState(false);
  const [flipbookError, setFlipbookError] = useState('');
  const renderSession = useRef(0);

  const activeCatalog = useMemo(
    () => catalogs.find((catalog) => catalog.id === activeId) ?? catalogs[0],
    [activeId, catalogs]
  );

  const archivedCatalogs = useMemo(
    () => catalogs.filter((catalog) => catalog.id !== activeCatalog?.id),
    [catalogs, activeCatalog]
  );

  useEffect(() => {
    const sessionId = ++renderSession.current;
    setPageImages([]);
    setTotalPages(activeCatalog?.pageCount ?? 1);
    setFlipbookError('');
    setIsPreparing(Boolean(activeCatalog));

    async function prepareBook() {
      if (!activeCatalog) { setIsPreparing(false); return; }
      if (activeCatalog.pageImages?.length) {
        setPageImages(activeCatalog.pageImages);
        setTotalPages(activeCatalog.pageImages.length);
        setIsPreparing(false);
        return;
      }
      let pdf: { destroy: () => Promise<void> } | null = null;
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
        const document = await pdfjs.getDocument({ url: activeCatalog.url }).promise;
        pdf = document;
        if (renderSession.current !== sessionId) return;
        setTotalPages(document.numPages);
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          if (renderSession.current !== sessionId) return;
          const page = await document.getPage(pageNumber);
          const original = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: 900 / original.width });
          const canvas = window.document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Не вдалося підготувати сторінки каталогу.');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvasContext: context, canvas, viewport }).promise;
          if (renderSession.current !== sessionId) return;
          const image = canvas.toDataURL('image/webp', .88);
          setPageImages((previous) => [...previous, image]);
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }
      } catch {
        if (renderSession.current === sessionId) setFlipbookError('Не вдалося підготувати каталог. Оновіть сторінку та спробуйте ще раз.');
      } finally {
        if (pdf) await pdf.destroy();
        if (renderSession.current === sessionId) setIsPreparing(false);
      }
    }
    void prepareBook();
    return () => { renderSession.current += 1; };
  }, [activeCatalog]);

  if (!activeCatalog) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
        Актуальних PDF-каталогів ще немає.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-brand/30 bg-gradient-to-br from-lime-50 via-white to-emerald-50 shadow-sm">
        <div className="border-b border-brand/20 px-5 py-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Каталог акцій</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{activeCatalog.title || activeCatalog.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Оновлено: {formatUpdatedAt(activeCatalog.updatedAt)} | Сторінок у PDF: {totalPages}
          </p>
        </div>

        <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
          {pageImages.length > 0 ? (
            <CatalogFlipbook key={activeCatalog.id} images={pageImages} totalPages={totalPages} />
          ) : isPreparing || !flipbookError ? (
            <div role="status" className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-sm text-slate-500"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand" /><span>Підготовка книжкового перегляду...</span></div>
          ) : null}
          {flipbookError ? <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{flipbookError}</p> : null}
        </div>
      </section>

      {showArchive && archivedCatalogs.length > 0 ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Архів каталогів</h2>
        <p className="mt-1 text-sm text-slate-600">Застарілі каталоги показані меншими картками. Клік перемикає активний каталог.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {archivedCatalogs.map((catalog) => (
              <button
                key={catalog.id}
                type="button"
                onClick={() => setActiveId(catalog.id)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand hover:bg-white"
              >
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{catalog.title || catalog.name}</p>
                <p className="mt-2 text-xs text-slate-500">Оновлено: {formatUpdatedAt(catalog.updatedAt)}</p>
                <p className="mt-1 text-xs text-slate-500">Сторінок: {catalog.pageCount}</p>
                <p className="mt-3 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">Відкрити тут</p>
              </button>
          ))}
        </div>
      </section> : null}
    </div>
  );
}
