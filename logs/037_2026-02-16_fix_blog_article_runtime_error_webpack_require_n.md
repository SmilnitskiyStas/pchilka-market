# 037_2026-02-16_fix_blog_article_runtime_error_webpack_require_n

## Дата
2026-02-16

## Що зроблено
- Проведено hotfix після помилки на сторінці статті блогу: `__webpack_require__.n is not a function`.
- Для стабільності в поточному середовищі збірки:
  - повернуто сумісний формат `params: Promise<{ slug: string }>` у динамічних маршрутах;
  - прибрано `generateMetadata` зі сторінки `app/blog/[slug]/page.tsx` (залишено `generateStaticParams`).
- У `app/news/[slug]/page.tsx` залишено `generateMetadata`, але з сумісною обробкою `params` через `await`.
- Синхронізовано `docs/project_status.md` із фактичною реалізацією SEO-метаданих.

## Що потрібно зробити далі
- Перезапустити dev-сервер.
- Якщо помилка повториться, очистити кеш збірки (`.next`) і запустити знову.
