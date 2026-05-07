'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type BannerSlide = {
  src: string;
  alt: string;
  href?: string;
};

type BannerCarouselProps = {
  slides: BannerSlide[];
  intervalMs?: number;
};

function shouldUseNativeImage(src: string): boolean {
  return src.startsWith('/media/') || src.startsWith('http://') || src.startsWith('https://');
}

export default function BannerCarousel({ slides, intervalMs = 4000 }: BannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [slides.length, intervalMs]);

  if (slides.length === 0) return null;

  return (
    <section className="group relative mb-6 overflow-hidden rounded-3xl border border-brand/30 bg-white shadow-sm">
      <div className="relative aspect-[1200/460] w-full">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          const useNativeImage = shouldUseNativeImage(slide.src);

          return (
            <div
              key={`${slide.src}-${index}`}
              className={`transition-opacity duration-700 ease-in-out ${
                isActive ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {slide.href ? (
                <Link href={slide.href} aria-label={slide.alt} className="absolute inset-0 block">
                  {useNativeImage ? (
                    <img
                      src={slide.src}
                      alt={slide.alt}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      className="h-full w-full object-contain transition-opacity duration-700 ease-in-out"
                    />
                  ) : (
                    <Image
                      src={slide.src}
                      alt={slide.alt}
                      fill
                      priority={index === 0}
                      className="object-contain transition-opacity duration-700 ease-in-out"
                    />
                  )}
                </Link>
              ) : (
                <>
                  {useNativeImage ? (
                    <img
                      src={slide.src}
                      alt={slide.alt}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      className="h-full w-full object-contain transition-opacity duration-700 ease-in-out"
                    />
                  ) : (
                    <Image
                      src={slide.src}
                      alt={slide.alt}
                      fill
                      priority={index === 0}
                      className="object-contain transition-opacity duration-700 ease-in-out"
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/40 px-3 py-2 opacity-100 transition-opacity duration-300 md:bottom-4 md:opacity-0 md:group-hover:opacity-100">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;

          return (
            <button
              key={slide.src}
              type="button"
              aria-label={`Перейти до банера ${index + 1}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 rounded-full transition-all ${
                isActive ? 'w-6 bg-brand' : 'w-2.5 bg-white/85 hover:bg-white'
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}
