# Task
Провести аудит проєкту та доробити підключення до MySQL для наповнення сайту через адмін-панель.

# Що зроблено
1. Додано новий модуль даних `site_profile_v1` у `site_settings`:
- тип і нормалізація: `lib/site-profile-settings.ts`
- репозиторій: `lib/site-profile-repository.ts`
- API: `app/api/admin/site-profile/route.ts`

2. Додано повне керування магазинами через MySQL:
- типи/нормалізація: `lib/store-types.ts`
- репозиторій `stores`: `lib/stores-repository.ts`
- API: `app/api/admin/stores/route.ts`

3. Додано адмін-розділ `Мережа`:
- сторінка: `app/admin/network/page.tsx`
- менеджер контактів + карти + списку магазинів: `components/admin/admin-network-manager.tsx`
- додано секцію в навігацію адмінки: `components/admin/admin-sections.ts`

4. Публічні сторінки підключено до БД:
- `app/about/contacts/page.tsx` читає `site_profile_v1`
- `app/about/stores/page.tsx` читає `stores` + `site_profile_v1` (з fallback на `public/info/our_store.txt`)
- `components/site-footer.tsx` читає `site_profile_v1`
- `components/site-header.tsx` підтягує контактні телефони з API

5. Форма зворотного зв’язку переведена з `localStorage` на MySQL:
- новий endpoint: `app/api/feedback/route.ts`
- `components/site-header.tsx` тепер відправляє `POST /api/feedback`
- запис у таблицю `feedback_requests`

6. Контент із адмінки для публічних сторінок:
- додано публічний репозиторій: `lib/public-content-repository.ts`
- home page (`app/page.tsx`) бере статистику магазинів з БД і останні пости блогу з БД (fallback залишено)
- новини та благодійність підключені до адмін-контенту:
  - списки: `components/admin-content-posts-list.tsx` + інтеграція в `app/news/page.tsx`, `app/about/charity/page.tsx`
  - детальні сторінки fallback на адмін-контент: `components/admin-content-post-page.tsx`, `app/news/[slug]/page.tsx`, `app/about/charity/[slug]/page.tsx`

7. Додано SQL seed:
- `docs/sql/005_seed_site_profile_and_stores.sql`

# Технічна перевірка
- `cmd /c npm run typecheck` -> success
- `cmd /c npm run build` -> failed with `spawn EPERM` (обмеження середовища запуску збірки)

# Виявлено під час аудиту
1. Значна частина сторінок все ще читає контент з файлів `public/info/*` і `public/img/**.txt` (own-brand, cooperation, career).
2. Частина метаданих/рядків у деяких файлах відображається з проблемою кодування (історичний артефакт файлів, не блокер для типізації).
3. Адмін-модулі `Власне класне` та частина контентних блоків home поки не мають повного CRUD у БД.

