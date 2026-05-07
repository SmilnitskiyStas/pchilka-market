# 120 / 2026-02-18 / admin_seo_manager_and_runtime_route_meta

## Що зроблено
- Замінено заглушку розділу `admin/seo` на робочий менеджер SEO-правил.
- Додано `components/admin/admin-seo-manager.tsx` з можливостями:
  - створення/редагування/видалення правил за маршрутом;
  - поля: `path`, `title`, `description`, `canonical`, `robots`;
  - швидкий вибір маршруту зі структури головного меню;
  - валідація canonical і унікальності правила для маршруту.
- Додано `lib/seo-settings.ts` для типів, нормалізації та роботи з localStorage.
- Додано runtime-застосування SEO-правил:
  - `components/seo-runtime-loader.tsx` застосовує для активного route:
    - `document.title`
    - `<meta name="description">`
    - `<meta name="robots">`
    - `<link rel="canonical">`
- Підключено runtime loader в `app/layout.tsx`.

## Перевірка
- Запущено `npm.cmd run typecheck`.
- Результат: без помилок.

## Що залишилось
- Перенести SEO-правила з localStorage у БД (Supabase) для SSR/серверної індексації.
- Розширити модуль Open Graph / Twitter Card полями за потреби.
- Додати керування `sitemap.xml` і `robots.txt` з адмінки (зараз лише route-level robots meta).
