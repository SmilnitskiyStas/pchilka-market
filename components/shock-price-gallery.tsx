'use client';

import { useEffect, useState } from 'react';

import type { ShockPriceSettings } from '@/lib/shock-price-settings';

export type ShockPriceImage = {
  id: string;
  name: string;
  url: string;
  updatedAt: string;
};

type ShockPriceGalleryProps = {
  images: ShockPriceImage[];
  settings: ShockPriceSettings;
};

function resolveGridClassName(settings: ShockPriceSettings) {
  const mobile = settings.columnsMobile;
  const tablet = settings.columnsTablet;
  const desktop = settings.columnsDesktop;

  const mobileClass = mobile === 2 ? 'grid-cols-2' : 'grid-cols-1';
  const tabletClass = tablet === 3 ? 'sm:grid-cols-3' : tablet === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1';
  const desktopClass =
    desktop === 6
      ? 'lg:grid-cols-6'
      : desktop === 5
        ? 'lg:grid-cols-5'
        : desktop === 4
          ? 'lg:grid-cols-4'
          : desktop === 2
            ? 'lg:grid-cols-2'
            : desktop === 1
              ? 'lg:grid-cols-1'
              : 'lg:grid-cols-3';

  return `${mobileClass} ${tabletClass} ${desktopClass}`;
}

export default function ShockPriceGallery({ images, settings }: ShockPriceGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeImage = activeIndex !== null ? images[activeIndex] : null;
  const activePosition = activeIndex !== null ? activeIndex + 1 : 0;
  const gridClassName = resolveGridClassName(settings);

  useEffect(() => {
    if (activeIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveIndex(null);
      if (event.key === 'ArrowRight') {
        setActiveIndex((prev) => (prev === null ? 0 : (prev + 1) % images.length));
      }
      if (event.key === 'ArrowLeft') {
        setActiveIndex((prev) => (prev === null ? 0 : (prev - 1 + images.length) % images.length));
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, images.length]);

  return (
    <>
      <div className={`mt-5 grid gap-3 sm:mt-6 sm:gap-4 ${gridClassName}`}>
        {images.map((image, index) => (
          <article
            key={image.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:shadow-lg sm:p-2"
          >
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              className="block w-full rounded-xl bg-slate-100 p-1 text-left transition duration-300 hover:opacity-95"
              aria-label={`Відкрити фото: ${image.name}`}
            >
              <img
                src={image.url}
                alt={image.name}
                loading="lazy"
                className="h-auto w-full rounded-lg object-contain transition-transform duration-300 hover:scale-[1.02]"
              />
            </button>
          </article>
        ))}
      </div>

      {activeImage ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-3 sm:p-6"
          onClick={() => setActiveIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="absolute right-2 top-2 z-10 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white sm:px-4 sm:py-2 sm:text-sm"
            >
              Закрити
            </button>

            <img
              src={activeImage.url}
              alt={activeImage.name}
              className="max-h-[74vh] w-full rounded-2xl bg-white object-contain sm:max-h-[88vh]"
            />

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => (prev === null ? 0 : (prev - 1 + images.length) % images.length))}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 sm:px-4 sm:py-2 sm:text-sm"
              >
                Попереднє
              </button>
              <p className="text-center text-sm font-semibold text-white">
                {activePosition} / {images.length}
              </p>
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => (prev === null ? 0 : (prev + 1) % images.length))}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 sm:px-4 sm:py-2 sm:text-sm"
              >
                Наступне
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
