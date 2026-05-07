# 066_2026-02-17_add_loyalty_submenu_and_pages

## Дата
2026-02-17

## Що зроблено
- Оновлено меню `content/menu.ts`:
  - для пункту `Програма лояльності` додано підменю:
    - `Про програму` (`/loyalty/about`)
    - `Правила програми` (`/loyalty/rules`)
    - `Мобільний застосунок` (`/loyalty/mobile-app`)
    - `Знижка пенсіонерам` (`/loyalty/senior-discount`)
- Створено нові сторінки розділу лояльності:
  - `app/loyalty/about/page.tsx`
  - `app/loyalty/rules/page.tsx`
  - `app/loyalty/mobile-app/page.tsx`
  - `app/loyalty/senior-discount/page.tsx`
- На сторінці `Мобільний застосунок` реалізовано вибір завантаження застосунку:
  - кнопка для Android;
  - кнопка для iOS.
- Для нових сторінок додано базові SEO metadata.
