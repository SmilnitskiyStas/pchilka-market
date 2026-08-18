'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';

const FLIP_DURATION_MS = 800;
const MAX_AUTO_FLIPBOOK_PAGES = 16;

export type PromotionCatalog = {
  id: string;
  name: string;
  url: string;
  updatedAt: string;
  pageCount: number;
};

type PromotionCatalogViewerProps = {
  catalogs: PromotionCatalog[];
};

type FlipPageProps = {
  imageSrc: string;
  pageNumber: number;
};

const FlipPage = forwardRef<HTMLDivElement, FlipPageProps>(function FlipPage({ imageSrc, pageNumber }, ref) {
  return (
    <div ref={ref} className="h-full w-full bg-white">
      <img src={imageSrc} alt={`Сторінка ${pageNumber}`} draggable={false} className="h-full w-full object-contain" />
    </div>
  );
});

function formatUpdatedAt(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function buildPdfViewerUrl(url: string, page: number) {
  return `${url}#page=${page}&view=FitH&toolbar=0&navpanes=0&scrollbar=0`;
}

function clampPage(page: number, total: number) {
  return Math.min(Math.max(1, page), Math.max(1, total));
}

export default function PromotionCatalogViewer({ catalogs }: PromotionCatalogViewerProps) {
  const [activeId, setActiveId] = useState(catalogs[0]?.id ?? '');
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(catalogs[0]?.pageCount ?? 1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPreparing, setIsPreparing] = useState(false);
  const [viewerMode, setViewerMode] = useState<'flipbook' | 'iframe'>('iframe');

  const flipBookRef = useRef<any>(null);

  const activeCatalog = useMemo(
    () => catalogs.find((catalog) => catalog.id === activeId) ?? catalogs[0],
    [activeId, catalogs]
  );

  const archivedCatalogs = useMemo(
    () => catalogs.filter((catalog) => catalog.id !== activeCatalog?.id),
    [catalogs, activeCatalog]
  );

  useEffect(() => {
    setCurrentPage(1);
    setPageImages([]);
    setViewerMode('iframe');
    setTotalPages(activeCatalog?.pageCount ?? 1);
    setIsPreparing(false);
  }, [activeCatalog]);

  if (!activeCatalog) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
        Актуальних PDF-каталогів ще немає.
      </div>
    );
  }

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;
  const canEnableFlipbook = totalPages <= MAX_AUTO_FLIPBOOK_PAGES;

  const enableFlipbook = async () => {
    if (isPreparing || !canEnableFlipbook) return;

    setIsPreparing(true);
    setPageImages([]);

    try {
      const pdfjs = await import('pdfjs-dist');
      const loadingTask = pdfjs.getDocument({
        url: activeCatalog.url,
        disableWorker: true
      } as any);
      const pdf = await loadingTask.promise;

      const pagesCount = pdf.numPages || activeCatalog.pageCount || 1;
      const renderedImages: string[] = new Array(pagesCount);

      for (let i = 1; i <= pagesCount; i += 1) {
        const page = await pdf.getPage(i);
        const viewportAtOne = page.getViewport({ scale: 1 });
        const targetWidth = 1200;
        const scale = targetWidth / viewportAtOne.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({
          canvasContext: context,
          canvas,
          viewport
        }).promise;

        renderedImages[i - 1] = canvas.toDataURL('image/webp', 0.9);
      }

      await pdf.destroy();
      setTotalPages(pagesCount);
      setPageImages(renderedImages.filter(Boolean));
      setViewerMode('flipbook');
      setCurrentPage(1);
    } catch {
      setViewerMode('iframe');
    } finally {
      setIsPreparing(false);
    }
  };

  const goFirst = () => {
    if (viewerMode === 'flipbook' && flipBookRef.current?.pageFlip) {
      flipBookRef.current.pageFlip().flip(0);
    }
    setCurrentPage(1);
  };

  const goPrev = () => {
    if (!canGoPrev) return;
    if (viewerMode === 'flipbook' && flipBookRef.current?.pageFlip) {
      flipBookRef.current.pageFlip().flipPrev();
    } else {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    }
  };

  const goNext = () => {
    if (!canGoNext) return;
    if (viewerMode === 'flipbook' && flipBookRef.current?.pageFlip) {
      flipBookRef.current.pageFlip().flipNext();
    } else {
      setCurrentPage((prev) => Math.min(totalPages, prev + 1));
    }
  };

  const goLast = () => {
    if (viewerMode === 'flipbook' && flipBookRef.current?.pageFlip) {
      flipBookRef.current.pageFlip().flip(Math.max(0, totalPages - 1));
    }
    setCurrentPage(totalPages);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-brand/30 bg-gradient-to-br from-lime-50 via-white to-emerald-50 shadow-sm">
        <div className="border-b border-brand/20 px-5 py-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Каталог акцій</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{activeCatalog.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Оновлено: {formatUpdatedAt(activeCatalog.updatedAt)} | Сторінок: {totalPages}
          </p>
        </div>

        <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 p-3">
            <p className="text-sm font-medium text-slate-700">{`Сторінка ${currentPage} з ${totalPages}`}</p>
            <div className="flex items-center gap-3">
              {viewerMode === 'iframe' ? <p className="text-xs text-slate-500">Швидкий режим</p> : null}

              {viewerMode === 'flipbook' ? (
                <button
                  type="button"
                  onClick={() => setViewerMode('iframe')}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                >
                  PDF-режим
                </button>
              ) : (
                <button
                  type="button"
                  onClick={enableFlipbook}
                  disabled={!canEnableFlipbook || isPreparing}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
                  title={
                    canEnableFlipbook
                      ? 'Увімкнути книжковий режим'
                      : `Книжковий режим доступний для каталогів до ${MAX_AUTO_FLIPBOOK_PAGES} сторінок`
                  }
                >
                  Книжковий режим
                </button>
              )}
            </div>
          </div>

          <div className="relative rounded-2xl border border-slate-300 bg-[#eef2e8] p-3 sm:p-4">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev || isPreparing}
              aria-label="Попередня сторінка"
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded bg-white/95 px-2 py-1.5 text-3xl leading-none text-slate-400 shadow-md transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-35 sm:left-3 sm:px-3 sm:py-2 sm:text-4xl"
            >
              &#8249;
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext || isPreparing}
              aria-label="Наступна сторінка"
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded bg-white/95 px-2 py-1.5 text-3xl leading-none text-slate-400 shadow-md transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-35 sm:right-3 sm:px-3 sm:py-2 sm:text-4xl"
            >
              &#8250;
            </button>

            <div className="h-[62vh] overflow-hidden rounded-xl border border-slate-400 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] sm:h-[68vh] lg:h-[72vh]">
              {isPreparing ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
                  <span>Підготовка книжкового режиму...</span>
                </div>
              ) : viewerMode === 'flipbook' && pageImages.length > 0 ? (
                <div className="flex h-full items-center justify-center bg-[#f1f1f1]">
                  <HTMLFlipBook
                    ref={flipBookRef}
                    style={{}}
                    width={700}
                    height={900}
                    minWidth={280}
                    maxWidth={1300}
                    minHeight={360}
                    maxHeight={1600}
                    size="stretch"
                    startPage={0}
                    drawShadow
                    flippingTime={FLIP_DURATION_MS}
                    usePortrait
                    startZIndex={0}
                    autoSize
                    maxShadowOpacity={0.45}
                    showCover={false}
                    showPageCorners
                    disableFlipByClick={false}
                    mobileScrollSupport={false}
                    clickEventForward
                    useMouseEvents
                    swipeDistance={20}
                    onFlip={(event: any) => {
                      const next = (event?.data ?? 0) + 1;
                      setCurrentPage(clampPage(next, totalPages));
                    }}
                    className="mx-auto"
                  >
                    {pageImages.map((src, index) => (
                      <FlipPage key={`${activeCatalog.id}-page-${index + 1}`} imageSrc={src} pageNumber={index + 1} />
                    ))}
                  </HTMLFlipBook>
                </div>
              ) : (
                <iframe
                  key={`${activeCatalog.id}-${currentPage}`}
                  src={buildPdfViewerUrl(activeCatalog.url, currentPage)}
                  title={`Сторінка ${currentPage}`}
                  className="pointer-events-none h-full w-full select-none border-0"
                />
              )}
            </div>
          </div>

          {!canEnableFlipbook ? (
            <p className="mt-3 text-xs text-slate-500">
              Для великих каталогів автоматично використовується швидкий PDF-режим для кращої продуктивності.
            </p>
          ) : null}

          <div className="mt-3 flex items-center justify-center gap-3 rounded-xl bg-white/85 p-2 text-slate-600">
            <button
              type="button"
              onClick={goFirst}
              disabled={!canGoPrev}
              className="rounded px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-35"
              aria-label="Перша сторінка"
            >
              &#171;
            </button>
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className="rounded px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-35"
              aria-label="Попередня сторінка"
            >
              &#8249;
            </button>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="rounded px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-35"
              aria-label="Наступна сторінка"
            >
              &#8250;
            </button>
            <button
              type="button"
              onClick={goLast}
              disabled={!canGoNext}
              className="rounded px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-35"
              aria-label="Остання сторінка"
            >
              &#187;
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Архів каталогів</h2>
        <p className="mt-1 text-sm text-slate-600">Застарілі каталоги показані меншими картками. Клік перемикає активний каталог.</p>

        {archivedCatalogs.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Поки що додано лише один поточний каталог.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archivedCatalogs.map((catalog) => (
              <button
                key={catalog.id}
                type="button"
                onClick={() => setActiveId(catalog.id)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand hover:bg-white"
              >
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{catalog.name}</p>
                <p className="mt-2 text-xs text-slate-500">Оновлено: {formatUpdatedAt(catalog.updatedAt)}</p>
                <p className="mt-1 text-xs text-slate-500">Сторінок: {catalog.pageCount}</p>
                <p className="mt-3 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">Відкрити тут</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
