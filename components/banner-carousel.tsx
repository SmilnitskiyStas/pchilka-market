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
  const pathname = src.split(/[?#]/)[0]?.toLowerCase() ?? src.toLowerCase();
  return pathname.endsWith('.mp4') || pathname.endsWith('.webm');
}

export default function BannerCarousel({ slides, intervalMs = 4000 }: BannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOnScreen, setIsOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  const container = useRef<HTMLElement | null>(null);
  const videoElements = useRef(new Map<number, HTMLVideoElement>());
  const activeSlide = slides[activeIndex] ?? slides[0];
  const activeVideo = isVideoSource(activeSlide?.src ?? '');
  const canPlay = isOnScreen && pageVisible;

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => setIsOnScreen(entry.isIntersecting), { threshold: 0.1 });
    if (container.current) observer?.observe(container.current);
    return () => { document.removeEventListener('visibilitychange', updateVisibility); observer?.disconnect(); };
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || !canPlay || (activeVideo && failedVideo !== activeSlide?.src)) return;

    const timer = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);

    return () => clearTimeout(timer);
  }, [activeIndex, slides.length, intervalMs, canPlay, activeVideo, activeSlide?.src, failedVideo]);

  useEffect(() => {
    setActiveIndex((index) => index < slides.length ? index : 0);
  }, [slides.length]);

  useEffect(() => {
    videoElements.current.forEach((video, index) => {
      if (index !== activeIndex || !canPlay) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // Autoplay may be restricted by a browser despite muted playback.
      });
    });
  }, [activeIndex, slides, canPlay]);

  if (slides.length === 0) return null;

  return (
    <section ref={container} className="home-banner-carousel" aria-label="Пропозиції мережі">
      <div className="home-banner-media">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          const isVideo = isVideoSource(slide.src);
          const useNativeImage = shouldUseNativeImage(slide.src);
          const imageSrc = getBannerImageSrc(slide.src, slide.id);
          const imageClassName = 'h-full w-full object-contain';
          const media = isVideo ? (isActive ? (
            <video
              ref={(element) => {
                if (element) videoElements.current.set(index, element);
                else videoElements.current.delete(index);
              }}
              src={slide.src}
              aria-label={slide.alt}
              className={imageClassName}
              autoPlay={canPlay}
              loop={slides.length === 1}
              muted
              playsInline
              preload={canPlay ? 'auto' : 'none'}
              onEnded={() => { if (slides.length > 1) setActiveIndex((previous) => (previous + 1) % slides.length); }}
              onError={() => setFailedVideo(slide.src)}
            />
          ) : null) : useNativeImage ? (
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
              inert={!isActive}
            >
              {slide.href ? (
                <Link href={slide.href} aria-label={slide.alt} className="block h-full w-full">
                  {media}
                </Link>
              ) : (
                <div className="h-full w-full">{media}</div>
              )}
              {isActive && failedVideo === slide.src ? <p role="status" className="absolute inset-x-4 bottom-4 rounded-xl bg-white/90 p-3 text-center text-sm text-slate-700">Не вдалося відтворити відео.</p> : null}
            </div>
          );
        })}
      </div>

      <div className="home-banner-controls">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;

          return (
            <button
              key={slide.src}
              type="button"
              aria-label={`Перейти до банера ${index + 1}`}
              aria-pressed={isActive}
              onClick={() => { setFailedVideo(null); setActiveIndex(index); }}
              className={isActive ? 'is-active' : ''}
            />
          );
        })}
      </div>
    </section>
  );
}
