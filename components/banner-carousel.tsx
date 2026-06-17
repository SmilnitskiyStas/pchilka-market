'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type BannerSlide = {
  id?: string;
  src: string;
  alt: string;
  href?: string;
};

type BannerCarouselProps = {
  slides: BannerSlide[];
  intervalMs?: number;
};

function shouldUseNativeImage(src: string): boolean {
  return (
    src.startsWith('/api/site-image') ||
    src.startsWith('/img/') ||
    src.startsWith('/media/') ||
    src.startsWith('http://') ||
    src.startsWith('https://')
  );
}

function encodeImageRef(src: string): string {
  const bytes = new TextEncoder().encode(src);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getBannerImageSrc(src: string, cacheKey?: string): string {
  if (src.startsWith('/api/site-image')) {
    return src;
  }

  if (!cacheKey || (!src.startsWith('/media/') && !src.startsWith('/img/') && !src.startsWith('http'))) {
    return src;
  }

  return `/api/site-image?ref=${encodeURIComponent(encodeImageRef(src))}&v=${encodeURIComponent(cacheKey)}`;
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
          const imageSrc = getBannerImageSrc(slide.src, slide.id);
          const imageClassName = 'h-full w-full object-contain';

          return (
            <div
              key={`${slide.src}-${index}`}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'pointer-events-auto z-10 opacity-100' : 'pointer-events-none z-0 opacity-0'
              }`}
              aria-hidden={!isActive}
            >
              {slide.href ? (
                <Link href={slide.href} aria-label={slide.alt} className="block h-full w-full">
                  {useNativeImage ? (
                    <img
                      src={imageSrc}
                      alt={slide.alt}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      className={imageClassName}
                    />
                  ) : (
                    <Image
                      src={imageSrc}
                      alt={slide.alt}
                      fill
                      priority={index === 0}
                      className="object-contain"
                    />
                  )}
                </Link>
              ) : (
                <div className="h-full w-full">
                  {useNativeImage ? (
                    <img
                      src={imageSrc}
                      alt={slide.alt}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      className={imageClassName}
                    />
                  ) : (
                    <Image
                      src={imageSrc}
                      alt={slide.alt}
                      fill
                      priority={index === 0}
                      className="object-contain"
                    />
                  )}
                </div>
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
