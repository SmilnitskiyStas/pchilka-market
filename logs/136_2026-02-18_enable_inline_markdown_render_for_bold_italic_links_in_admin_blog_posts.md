# 136 / 2026-02-18 / enable_inline_markdown_render_for_bold_italic_links_in_admin_blog_posts

## Що зроблено
- Оновлено `components/admin-blog-post-page.tsx`.
- Додано inline-рендер markdown у fallback-статтях з адмінки:
  - `**жирний**`
  - `_курсив_`
  - `[текст](url)`
- Inline-форматування тепер рендериться не як сирий текст у `<p>`, а як відповідні HTML-елементи (`<strong>`, `<em>`, `<a>`).
- Застосовано для:
  - абзаців
  - пунктів списків
  - заголовків H2/H3.

## Перевірка
- Виконано `npm.cmd run typecheck`.
- Результат: без помилок.
