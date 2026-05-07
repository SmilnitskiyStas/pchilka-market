# 064_2026-02-17_slightly_stretch_home_banner_visual

## Дата
2026-02-17

## Що зроблено
- На прохання зроблено легке «розтягування» (візуальне збільшення) головного банера.
- У `components/banner-carousel.tsx` для основного шару банера додано scale:
  - mobile: `scale-[1.05]`
  - small tablets: `sm:scale-[1.03]`
  - desktop: `lg:scale-100`
- Це робить кадр щільнішим на малих екранах без різкого кропу.
