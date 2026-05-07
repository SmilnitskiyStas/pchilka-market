# 016_2026-02-16_fix_maximum_update_depth_flipbook

## Дата
2026-02-16

## Що зроблено
- Виправлено помилку `Maximum update depth exceeded` у `components/promotion-catalog-viewer.tsx`.
- Стабілізовано `ensurePagesRendered`:
  - прибрано залежності від `pageImages` та `totalPages` у `useCallback`;
  - додано `pageImagesRef` і `totalPagesRef`, щоб уникнути циклічних перезапусків ефекту.
- Основний `useEffect` завантаження PDF більше не перезапускається через зміну рендер-кешу сторінок.
- Збережено preload сторінок для flipbook-перегляду.

## Що потрібно зробити далі
- Перезапустити dev-сервер і перевірити, що помилка в консолі більше не з'являється.
