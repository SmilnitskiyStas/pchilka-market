# 074_2026-02-17_add_separate_app_download_page_with_store_badges

## Дата
2026-02-17

## Що зроблено
- Створено окрему сторінку завантаження застосунку:
  - `app/loyalty/mobile-app/download/page.tsx`
- Додано прямі посилання:
  - Android: `https://play.google.com/store/apps/details?id=io.uployal.pchilka&pcampaignid=web_share`
  - iOS: `https://apps.apple.com/ua/app/pchilka/id1602515998`
- На сторінці реалізовано клікабельні зображення Store-бейджів (Google Play / App Store).
- Додано логотип `Pchilka` у верхній частині сторінки.
- Адаптивність:
  - на мобільних картки завантаження відображаються одна під одною;
  - на ширших екранах — у 2 колонки.
- Для сторінки завантаження вимкнено глобальне меню/хедер:
  - оновлено `components/site-header.tsx` (маршрут `'/loyalty/mobile-app/download'`).
- На сторінці `app/loyalty/mobile-app/page.tsx`:
  - оновлено кнопки Android/iOS на реальні URL;
  - додано кнопку переходу на окрему сторінку завантаження.
