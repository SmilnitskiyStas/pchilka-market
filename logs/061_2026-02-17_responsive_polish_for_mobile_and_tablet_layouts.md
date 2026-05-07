# 061_2026-02-17_responsive_polish_for_mobile_and_tablet_layouts

## Дата
2026-02-17

## Що зроблено
- Додатково покращено адаптивність для мобільних і планшетних екранів.
- Оновлено `components/banner-carousel.tsx`:
  - на мобільних змінено співвідношення сторін банера (`4:3`);
  - індикатори банера завжди видимі на touch-екранах.
- Оновлено `components/shock-price-gallery.tsx`:
  - ущільнено відступи карток і сітки на мобільних;
  - покращено mobile-layout модального перегляду (кнопка закриття, висота зображення, компактніші кнопки навігації).
- Оновлено контентні сторінки (`app/page.tsx`, `app/blog/page.tsx`, `app/news/page.tsx`, `app/about/charity/page.tsx`, `app/about/stores/page.tsx`, `app/about/contacts/page.tsx`, `app/about/reporting/page.tsx`, `app/promotions/shock-price/page.tsx`, `app/promotions/buy-milka-win/page.tsx`):
  - зменшено базові відступи на мобільних;
  - адаптовано розміри заголовків для вузьких екранів;
  - підлаштовано сітки/картки під компактний рендер.
- На сторінці контактів (`app/about/contacts/page.tsx`) зроблено більш стабільне mobile-вирівнювання заголовка карти та кнопки маршруту.
