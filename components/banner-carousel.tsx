'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

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

function isVideoSource(src: string): boolean {
  const pathname = src.split('?')[0]?.toLowerCase() ?? src.toLowerCase();
  return pathname.endsWith('.mp4') || pathname.endsWith('.webm');
}

export default function BannerCarousel({ slides, intervalMs = 4000 }: BannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoElements = useRef(new Map<number, HTMLVideoElement>());

  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [slides.length, intervalMs]);

  useEffect(() => {
    videoElements.current.forEach((video, index) => {
      if (index !== activeIndex) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // Autoplay may be restricted by a browser despite muted playback.
      });
    });
  }, [activeIndex, slides]);

  if (slides.length === 0) return null;

  return (
    <section className="group relative mb-6 overflow-hidden rounded-3xl border border-brand/30 bg-white shadow-sm">
      <div className="relative aspect-[1200/460] w-full">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          const isVideo = isVideoSource(slide.src);
          const useNativeImage = shouldUseNativeImage(slide.src);
          const imageSrc = getBannerImageSrc(slide.src, slide.id);
          const imageClassName = 'h-full w-full object-contain';
          const media = isVideo ? (
            <video
              ref={(element) => {
                if (element) videoElements.current.set(index, element);
                else videoElements.current.delete(index);
              }}
              src={slide.src}
              aria-label={slide.alt}
              className={imageClassName}
              autoPlay={isActive}
              loop
              muted
              playsInline
              preload={index === 0 ? 'auto' : 'metadata'}
            />
          ) : useNativeImage ? (
            <img
              src={imageSrc}
              alt={slide.alt}
              loading={index === 0 ? 'eager' : 'lazy'}
              className={imageClassName}
              onError={() => {
                console.error('[banner-carousel] Banner image failed to load', {
                  slideId: slide.id,
                  originalSrc: slide.src,
                  imageSrc
                });
              }}
            />
          ) : (
            <Image
              src={imageSrc}
              alt={slide.alt}
              fill
              priority={index === 0}
              className="object-contain"
            />
          );

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
                  {media}
                </Link>
              ) : (
                <div className="h-full w-full">{media}</div>
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
