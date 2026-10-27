'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import CatalogFlipbook from '@/components/catalog-flipbook';

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
  const renderSession = useRef(0);

  const activeCatalog = useMemo(
    () => catalogs.find((catalog) => catalog.id === activeId) ?? catalogs[0],
    [activeId, catalogs]
  );

  const archivedCatalogs = useMemo(
    () => catalogs.filter((catalog) => catalog.id !== activeCatalog?.id),
    [catalogs, activeCatalog]
  );

  const canEnableFlipbook = Boolean(activeCatalog) &&
    (Boolean(activeCatalog?.pageImages?.length) || (activeCatalog?.pageCount || 1) <= MAX_AUTO_FLIPBOOK_PAGES);

  useEffect(() => {
    setCurrentPage(1);
    setPageImages([]);
    setViewerMode(canEnableFlipbook ? 'flipbook' : 'iframe');
    setTotalPages(activeCatalog?.pageCount ?? 1);
    setIsPreparing(false);
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
    renderSession.current += 1;
  }, []);
  const canGoPrev = currentPage > 1 && (viewerMode !== 'flipbook' || Boolean(pageImages[currentPage - 2]));
  const canGoNext = currentPage < totalPages && (viewerMode !== 'flipbook' || Boolean(pageImages[currentPage]));

  const enableFlipbook = async () => {
    if (!activeCatalog) return;
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
      if (renderSession.current !== sessionId) return;
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
  }, [activeCatalog]);

  if (!activeCatalog) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
        Актуальних PDF-каталогів ще немає.
      </div>
    );
  }

  const goToPage = (page: number) => setCurrentPage(clampPage(page, totalPages));
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
            Оновлено: {formatUpdatedAt(activeCatalog.updatedAt)} | Сторінок у PDF: {totalPages}
          </p>
        </div>

        <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
          {viewerMode === 'flipbook' && pageImages.length > 0 ? (
            <CatalogFlipbook key={activeCatalog.id} images={pageImages} totalPages={totalPages} initialPage={currentPage} onPageChange={setCurrentPage} onPdfMode={() => setViewerMode('iframe')} />
          ) : (
            <>
              <div className="catalog-book-toolbar">
                <p>{`Сторінка ${currentPage} з ${totalPages}`}</p>
                <button type="button" onClick={enableFlipbook} disabled={!canEnableFlipbook || isPreparing}>Книжковий режим</button>
              </div>
              <p className="catalog-book-hint">Швидкий режим</p>
              <div className="relative h-[68vh] min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {isPreparing ? <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand" /><span>Підготовка книжкового режиму...</span></div> : <iframe key={`${activeCatalog.id}-${currentPage}`} src={buildPdfViewerUrl(activeCatalog.url, currentPage)} title={`Сторінка ${currentPage}`} className="pointer-events-none h-full w-full select-none border-0" />}
              </div>
              {flipbookError ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Книжковий перегляд тимчасово недоступний: {flipbookError}</p> : null}
              {!canEnableFlipbook ? <p className="catalog-book-hint">Для цього каталогу доступний PDF-режим.</p> : null}
              <div className="catalog-book-navigation">
                <button type="button" onClick={goFirst} disabled={!canGoPrev || isPreparing} aria-label="Перша сторінка">«</button>
                <button type="button" onClick={goPrev} disabled={!canGoPrev || isPreparing} aria-label="Попередня сторінка">‹</button>
                <span>{currentPage} / {totalPages}</span>
                <button type="button" onClick={goNext} disabled={!canGoNext || isPreparing} aria-label="Наступна сторінка">›</button>
                <button type="button" onClick={goLast} disabled={!canGoNext || isPreparing} aria-label="Остання сторінка">»</button>
              </div>
            </>
          )}
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
