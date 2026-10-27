'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCatalogLeaves, getCatalogSpread, type CatalogLeaf } from '@/lib/catalog-spread';

const HTMLFlipBook = dynamic(() => import('react-pageflip'), { ssr: false });

type BookEngine = {
  flipNext: (corner?: 'top' | 'bottom') => void;
  flipPrev: (corner?: 'top' | 'bottom') => void;
  flip: (index: number, corner?: 'top' | 'bottom') => void;
};
type Props = { images: string[]; totalPages: number };

export default function CatalogFlipbook({ images, totalPages }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const book = useRef<{ pageFlip: () => BookEngine } | null>(null);
  const pageIndexRef = useRef(0);
  const [index, setIndex] = useState(pageIndexRef.current);
  const [portrait, setPortrait] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [prepared, setPrepared] = useState<{ images: string[]; leaves: CatalogLeaf[]; ratio: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number; duration: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false); setLoadError(false);
    Promise.all(images.map((src) => new Promise<{ src: string; width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = src;
    }))).then((pages) => {
      if (cancelled) return;
      const model = buildCatalogLeaves(pages);
      const start = Math.min(pageIndexRef.current, Math.max(0, model.leaves.length - 1));
      pageIndexRef.current = start; setIndex(start);
      setPrepared({ ...model, images });
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [images]);

  const ratio = prepared?.ratio ?? .677;
  const leafCount = prepared?.leaves.length ?? 0;

  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const measure = () => {
      const width = element.clientWidth;
      if (width <= 0) return;
      const heightLimit = Math.max(340, Math.min(800, window.innerHeight * .72));
      const pageWidth = Math.floor(Math.min(width >= 640 ? width / 2 : width, heightLimit * ratio));
      const next = { width: pageWidth, height: Math.round(pageWidth / ratio), duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 900 };
      setDimensions((previous) => previous?.width === next.width && previous?.height === next.height && previous?.duration === next.duration ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [ratio]);

  const onFlip = useCallback((event: { data: number }) => {
    setIndex(event.data);
    pageIndexRef.current = event.data;
  }, []);
  const onOrientation = useCallback((event: { data: string }) => setPortrait(event.data === 'portrait'), []);
  const onState = useCallback((event: { data: string }) => setBusy(event.data !== 'read' && event.data !== 'fold_corner'), []);
  const onInit = useCallback((event: { data: { page: number; mode: string } }) => {
    setReady(true); setBusy(false); setPortrait(event.data.mode === 'portrait');
    setIndex(event.data.page); pageIndexRef.current = event.data.page;
  }, []);
  const leaves = useMemo(() => prepared?.leaves.map((leaf, page) => (
    <div key={`${leaf.src}-${leaf.part}`} className={`catalog-book-leaf catalog-book-leaf-${leaf.part}`} data-density="soft">
      <img src={leaf.src} alt={`Сторінка ${page + 1}`} draggable={false} />
    </div>
  )) ?? [], [prepared]);

  const spread = getCatalogSpread(index, leafCount, portrait);
  const canPrev = ready && spread.first > 1 && !busy;
  const canNext = ready && spread.last < leafCount && !busy;
  const range = spread.first === spread.last ? `${spread.first}` : `${spread.first}–${spread.last}`;
  const next = () => { if (canNext) book.current?.pageFlip()?.flipNext('bottom'); };
  const prev = () => { if (canPrev) book.current?.pageFlip()?.flipPrev('bottom'); };
  const goFirst = () => { if (canPrev) book.current?.pageFlip()?.flip(0, 'bottom'); };
  const goLast = () => { if (canNext) book.current?.pageFlip()?.flip(leafCount - 1, 'bottom'); };
  const singleSide = !portrait && (spread.first === 1 || spread.first === spread.last);

  return (
    <div className="catalog-book" tabIndex={0} role="group" aria-label="Книжковий перегляд каталогу" onKeyDown={(event) => {
      const action = ({ ArrowRight: next, ArrowLeft: prev, Home: goFirst, End: goLast } as Record<string, () => void>)[event.key];
      if (action) { event.preventDefault(); action(); }
    }}>
      <div className="catalog-book-toolbar">
        <p aria-live="polite">{leafCount ? <>{spread.first === spread.last ? 'Сторінка' : 'Сторінки'} {range} з {leafCount}</> : 'Підготовка сторінок...'}</p>
      </div>
      <p className="catalog-book-hint">Потягніть за кут сторінки або скористайтеся стрілками</p>
      <div ref={host} className="catalog-book-host">
        {dimensions && prepared?.images === images ? <div className="catalog-book-position" style={{ transform: singleSide ? `translateX(${spread.first === 1 ? -dimensions.width / 2 : dimensions.width / 2}px)` : undefined }}>
          <HTMLFlipBook
            key={`${dimensions.width}-${dimensions.height}`}
            ref={book}
            width={dimensions.width} height={dimensions.height}
            size="fixed" minWidth={dimensions.width} maxWidth={dimensions.width} minHeight={dimensions.height} maxHeight={dimensions.height}
            startPage={Math.min(pageIndexRef.current, leafCount - 1)}
            className="catalog-book-pages" style={{ margin: '0 auto' }}
            drawShadow flippingTime={dimensions.duration} usePortrait startZIndex={1} autoSize maxShadowOpacity={.35}
            showCover mobileScrollSupport={false} clickEventForward useMouseEvents swipeDistance={30} showPageCorners disableFlipByClick={false}
            renderOnlyPageLengthChange
            onFlip={onFlip} onChangeOrientation={onOrientation} onChangeState={onState} onInit={onInit}
          >{leaves}</HTMLFlipBook>
        </div> : <p className="catalog-book-loading" role={loadError ? 'alert' : 'status'}>{loadError ? 'Не вдалося завантажити сторінки. Оновіть сторінку та спробуйте ще раз.' : 'Підготовка книжкового перегляду...'}</p>}
      </div>
      <div className="catalog-book-navigation">
        <button type="button" onClick={goFirst} disabled={!canPrev} aria-label="Перша сторінка">«</button>
        <button type="button" onClick={prev} disabled={!canPrev} aria-label="Попередня сторінка">‹</button>
        <span>{leafCount ? `${range} / ${leafCount}` : '…'}</span>
        <button type="button" onClick={next} disabled={!canNext} aria-label="Наступна сторінка">›</button>
        <button type="button" onClick={goLast} disabled={!canNext} aria-label="Остання сторінка">»</button>
      </div>
      {images.length < totalPages ? <p className="catalog-book-hint">Підготовлено сторінок: {images.length} із {totalPages}</p> : null}
    </div>
  );
}
