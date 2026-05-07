# 135 / 2026-02-18 / support_external_image_urls_as_links_or_plain_lines_in_admin_blog_markdown

## Що зроблено
- Оновлено `components/admin-blog-post-page.tsx`.
- Додано більш гнучке розпізнавання зображень у markdown для статей з адмінки.

Тепер рендерер підтримує:
1. Класичний markdown-image: `![alt](url)`
2. Повний URL картинки окремим рядком: `https://site.com/image.jpg`
3. Markdown-посилання на картинку: `[текст](https://site.com/image.jpg)`

- Додано helper `looksLikeImageUrl(...)` (http/https, `/img/...`, `data:image/...`, з перевіркою розширення файлу).

## Перевірка
- Виконано `npm.cmd run typecheck`.
- Результат: без помилок.
