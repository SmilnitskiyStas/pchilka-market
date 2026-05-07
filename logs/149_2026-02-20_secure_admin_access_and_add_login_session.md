# 149 — Захист адмін-панелі та авторизація admin

## Що зроблено
- Додано сесійну авторизацію для адмінки:
  - `lib/admin-auth.ts`:
    - перевірка логіна/пароля admin;
    - генерація та валідація підписаної cookie-сесії;
    - утиліти для встановлення/очищення cookie;
    - утиліти для перевірки авторизації в API.
- Додано API авторизації:
  - `app/api/admin/auth/login/route.ts` (`POST`) — вхід.
  - `app/api/admin/auth/logout/route.ts` (`POST`) — вихід.
- Додано сторінку входу:
  - `app/login/page.tsx` — форма логіну з редіректом у `next`.
- Закрито доступ до адмін-сторінок для неавторизованих:
  - `app/admin/layout.tsx` — перевірка сесії і редірект на `/login?next=...`.
- Додано кнопку виходу в адмін-навігацію:
  - `components/admin/admin-nav.tsx`.
- Захищено mutating-операції адмін API (тільки для авторизованого admin):
  - `app/api/admin/banners/route.ts` (`PUT`);
  - `app/api/admin/promotions/route.ts` (`PUT`);
  - `app/api/admin/blog/content/route.ts` (`PUT`);
  - `app/api/admin/integrations/route.ts` (`PUT`);
  - `app/api/admin/seo/rules/route.ts` (`PUT`);
  - `app/api/admin/site-profile/route.ts` (`PUT`);
  - `app/api/admin/stores/route.ts` (`PUT`);
  - `app/api/admin/images/route.ts` (`POST`).
- Оновлено приклад env:
  - `.env.example`:
    - `ADMIN_USERNAME`
    - `ADMIN_PASSWORD`
    - `ADMIN_SESSION_SECRET`

## Що важливо по сумісності
- `GET` у `/api/admin/*` залишено без auth, щоб не зламати публічні runtime-компоненти (SEO/аналітика/контакти), які вже читають ці ендпоінти.
- Захист застосовано до запису/зміни контенту.

## Перевірка
- `npm run typecheck` — успішно.
- `npm run build` — не виконано в цьому середовищі: `spawn EPERM`.
- `npm run lint` — не виконано автоматично: Next просить інтерактивно ініціалізувати lint-конфіг.

## Що залишилось
- Додати/перевірити значення `ADMIN_*` у `.env.local`.
- За потреби винести публічні read-ендпоінти з `/api/admin/*` в окремий namespace (`/api/public/*`) на наступному етапі hardening.
