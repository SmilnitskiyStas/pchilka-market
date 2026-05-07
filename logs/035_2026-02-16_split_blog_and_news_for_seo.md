# 035_2026-02-16_split_blog_and_news_for_seo

## Дата
2026-02-16

## Що зроблено
- Виконано SEO-розділення контенту між розділами `Блог` і `Новини мережі`.
- Створено окреме сховище новин: `content/news.ts`.
- Оновлено сторінку списку новин `app/news/page.tsx`:
  - тепер використовує `newsPosts`;
  - посилання ведуть на `/news/[slug]` (а не на `/blog/[slug]`).
- Додано окрему сторінку деталей новини: `app/news/[slug]/page.tsx`.
- Для динамічних сторінок додано SEO-метадані:
  - `app/news/[slug]/page.tsx` -> `generateMetadata`;
  - `app/blog/[slug]/page.tsx` -> `generateMetadata`.
- Для сторінки списку блогу додано `metadata` в `app/blog/page.tsx`.
- Оновлено документацію:
  - `docs/project_status.md`;
  - `docs/site_content.md`.

## Що потрібно зробити далі
- За потреби додати окремі Open Graph-зображення для сторінок `/blog/[slug]` і `/news/[slug]`.
- При переході на БД перенести `content/blog.ts` і `content/news.ts` у Supabase з окремими таблицями/типами контенту.
