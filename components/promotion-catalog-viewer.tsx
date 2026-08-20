'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const FLIP_DURATION_MS = 800;
const MAX_AUTO_FLIPBOOK_PAGES = 16;

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

function buildPdfViewerUrl(url: string, page: number) {
  // `FitH` fits the page width and cuts off tall pages inside the viewer.
  // `page-fit` keeps the whole PDF page visible within the available frame.
  return `${url}#page=${page}&zoom=page-fit&toolbar=0&navpanes=0&scrollbar=0`;
}

function clampPage(page: number, total: number) {
  return Math.min(Math.max(1, page), Math.max(1, total));
}

export default function PromotionCatalogViewer({ catalogs, showArchive = false }: PromotionCatalogViewerProps) {
  const [activeId, setActiveId] = useState(catalogs[0]?.id ?? '');
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(catalogs[0]?.pageCount ?? 1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPreparing, setIsPreparing] = useState(false);
  const [viewerMode, setViewerMode] = useState<'flipbook' | 'iframe'>('iframe');
  const [flipbookError, setFlipbookError] = useState('');
  const [flippingPage, setFlippingPage] = useState<{ imageSrc: string; direction: 'next' | 'prev' } | null>(null);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);
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
    setCurrentPage(1);
    setPageImages([]);
    setViewerMode(canEnableFlipbook ? 'flipbook' : 'iframe');
    setTotalPages(activeCatalog?.pageCount ?? 1);
    setIsPreparing(false);
    setFlippingPage(null);
    setFlipbookError('');
    renderSession.current += 1;
  }, [activeCatalog]);

  useEffect(() => {
    if (!activeCatalog?.pageImages?.length) return;
    setPageImages(activeCatalog.pageImages);
    setTotalPages(activeCatalog.pageImages.length);
    setViewerMode('flipbook');
    setIsPreparing(false);
  }, [activeCatalog]);

  useEffect(() => () => {
    if (flipTimer.current) clearTimeout(flipTimer.current);
  }, []);

  if (!activeCatalog) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
        Актуальних PDF-каталогів ще немає.
      </div>
    );
  }

  const canEnableFlipbook = totalPages <= MAX_AUTO_FLIPBOOK_PAGES;
  const canGoPrev = currentPage > 1 && (viewerMode !== 'flipbook' || Boolean(pageImages[currentPage - 2]));
  const canGoNext = currentPage < totalPages && (viewerMode !== 'flipbook' || Boolean(pageImages[currentPage]));

  const enableFlipbook = async () => {
    if (activeCatalog.pageImages?.length) {
      setPageImages(activeCatalog.pageImages);
      setTotalPages(activeCatalog.pageImages.length);
      setViewerMode('flipbook');
      return;
    }
    if (isPreparing || !canEnableFlipbook) return;

    setIsPreparing(true);
    setPageImages([]);
    const sessionId = renderSession.current;

    try {
      // The legacy browser build includes compatibility shims required by
      // browsers where the standard PDF.js build falls back to the iframe.
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      const loadingTask = pdfjs.getDocument({
        url: activeCatalog.url
      } as any);
      const pdf = await loadingTask.promise;

      const pagesCount = pdf.numPages || activeCatalog.pageCount || 1;
      const renderPage = async (pageNumber: number): Promise<string> => {
        const page = await pdf.getPage(pageNumber);
        const viewportAtOne = page.getViewport({ scale: 1 });
        const targetWidth = 900;
        const scale = targetWidth / viewportAtOne.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Браузер не підтримує рендеринг сторінок каталогу.');

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({
          canvasContext: context,
          canvas,
          viewport
        }).promise;

        return canvas.toDataURL('image/webp', 0.88);
      };

      const firstPage = await renderPage(1);
      if (renderSession.current !== sessionId) {
        await pdf.destroy();
        return;
      }

      setTotalPages(pagesCount);
      setPageImages([firstPage]);
      setViewerMode('flipbook');
      setCurrentPage(1);
      setIsPreparing(false);

      for (let pageNumber = 2; pageNumber <= pagesCount; pageNumber += 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        const image = await renderPage(pageNumber);
        if (renderSession.current !== sessionId) {
          await pdf.destroy();
          return;
        }
        setPageImages((previous) => {
          const next = [...previous];
          next[pageNumber - 1] = image;
          return next;
        });
      }

      await pdf.destroy();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не вдалося підготувати 3D-перегляд.';
      setFlipbookError(message);
      setViewerMode('iframe');
    } finally {
      if (renderSession.current === sessionId) setIsPreparing(false);
    }
  };

  useEffect(() => {
    if (!canEnableFlipbook) return;
    void enableFlipbook();
  }, [activeCatalog?.id]);

  const goToPage = (page: number) => {
    const nextPage = clampPage(page, totalPages);
    if (nextPage === currentPage || flippingPage) return;

    if (viewerMode !== 'flipbook' || !pageImages[currentPage - 1]) {
      setCurrentPage(nextPage);
      return;
    }

    const direction = nextPage > currentPage ? 'next' : 'prev';
    setFlippingPage({ imageSrc: pageImages[currentPage - 1], direction });
    setCurrentPage(nextPage);
    if (flipTimer.current) clearTimeout(flipTimer.current);
    flipTimer.current = setTimeout(() => setFlippingPage(null), FLIP_DURATION_MS);
  };

  const goFirst = () => goToPage(1);
  const goPrev = () => goToPage(currentPage - 1);
  const goNext = () => goToPage(currentPage + 1);
  const goLast = () => goToPage(totalPages);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-brand/30 bg-gradient-to-br from-lime-50 via-white to-emerald-50 shadow-sm">
        <div className="border-b border-brand/20 px-5 py-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Каталог акцій</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{activeCatalog.title || activeCatalog.name}</h1>
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

            <div
              className={`rounded-xl border border-slate-400 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] ${
                viewerMode === 'flipbook'
                  ? 'min-h-[62vh] overflow-auto sm:min-h-[68vh] lg:min-h-[72vh]'
                  : 'h-[62vh] overflow-hidden sm:h-[68vh] lg:h-[72vh]'
              }`}
            >
              {isPreparing ? (
                <div className="flex min-h-[62vh] flex-col items-center justify-center gap-3 text-sm text-slate-500 sm:min-h-[68vh] lg:min-h-[72vh]">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
                  <span>Підготовка книжкового режиму...</span>
                </div>
              ) : viewerMode === 'flipbook' && pageImages.length > 0 ? (
                <div
                  className="flex min-h-[62vh] touch-pan-y items-center justify-center bg-[#20251f] p-3 sm:min-h-[68vh] sm:p-6 lg:min-h-[72vh]"
                  onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
                  onTouchEnd={(event) => {
                    if (touchStartX.current === null) return;
                    const delta = event.changedTouches[0].clientX - touchStartX.current;
                    touchStartX.current = null;
                    if (Math.abs(delta) < 45) return;
                    if (delta < 0) goNext(); else goPrev();
                  }}
                >
                  <div className="relative w-full max-w-[680px]" style={{ perspective: '2200px' }}>
                    <div className="absolute inset-y-2 left-3 right-1 z-0 rounded-md bg-black/45 shadow-[0_22px_36px_rgba(0,0,0,0.65)]" />
                    <div className="relative z-10 overflow-hidden rounded-md bg-white shadow-[0_26px_48px_rgba(0,0,0,0.48)]">
                      <img
                        src={pageImages[currentPage - 1]}
                        alt={`Сторінка ${currentPage}`}
                        draggable={false}
                        className="block h-auto max-h-[72vh] w-full object-contain"
                      />
                      {flippingPage ? (
                        <div
                          className={`absolute inset-0 z-30 ${flippingPage.direction === 'next' ? 'book-flip-next' : 'book-flip-prev'}`}
                          style={{ transformOrigin: flippingPage.direction === 'next' ? 'left center' : 'right center' }}
                        >
                          <img src={flippingPage.imageSrc} alt="" draggable={false} className="h-full w-full object-cover" />
                          <span className="absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-white/20" />
                        </div>
                      ) : null}
                    </div>
                    <div className="pointer-events-none absolute inset-x-4 bottom-0 z-0 h-5 rounded-full bg-black/35 blur-lg" />
                  </div>
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

          {viewerMode === 'iframe' && flipbookError ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              3D-перегляд тимчасово недоступний: {flipbookError}
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
