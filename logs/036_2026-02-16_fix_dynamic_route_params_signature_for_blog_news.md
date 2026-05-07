# 036_2026-02-16_fix_dynamic_route_params_signature_for_blog_news

## Дата
2026-02-16

## Що зроблено
- Виправлено сигнатури динамічних маршрутів на стандартний формат Next.js:
  - `app/blog/[slug]/page.tsx`
  - `app/news/[slug]/page.tsx`
- Було: `params: Promise<{ slug: string }>` з `await params`.
- Стало: `params: { slug: string }` без `await`.
- Оновлено відповідні `generateMetadata`:
  - тепер працюють із `params.slug` напряму.

## Чому
- Нетипова сигнатура `params` могла спричиняти runtime-збій під час завантаження сторінки статті (`__webpack_require__.n is not a function`) у клієнтській навігації.

## Що потрібно зробити далі
- Перезапустити dev-сервер і перевірити перехід на `/blog/[slug]` та `/news/[slug]`.
- Якщо помилка повториться, очистити `.next` і перевірити повторно.
