# HTTP 500 на адресі нової публікації

Помилку відтворено локально на production-збірці: GET `/news/vse-bude-dobre` повернув HTTP 500, журнал Next.js містив `Page changed from static to dynamic at runtime /news/vse-bude-dobre, reason: unstable_noStore()`. Порожній `generateStaticParams()` позначав маршрут як статичний, але спільний layout викликає актуальні налаштування сайту через `unstable_noStore()`. На новій адресі, відсутній під час збірки, це спричиняло заборонений перехід режиму.

Для `/news/[slug]`, `/blog/[slug]` та `/about/charity/[slug]` додано `dynamic = 'force-dynamic'`, прибрано непотрібні generateStaticParams та імпорти масивів. Вибір опублікованого контенту й фільтрація чернеток не змінені. Нові адреси більше не потребують попереднього статичного переліку під час збірки.

Додано scripts/check-public-post-routes.cjs: реальні локальні HTTP-запити до наданої адреси й нових slug для всіх трьох типів публікацій. Перевірка не створює матеріалів і не змінює робочу БД. Документацію контенту оновлено. Пряме читання production-адреси інструментами було недоступне; причина підтверджена відтворенням на локальному production-сервері. Розгортання та коміт не виконувалися.

Перевірки після виправлення: production build із перевіркою типів пройшов; `/news/vse-bude-dobre` та нові адреси `/news/post-created-after-build-…`, `/blog/post-created-after-build-…`, `/about/charity/post-created-after-build-…` повернули HTTP 200. Синтаксис скрипту й git diff --check успішні. Перевірка стосується серверного відкриття маршрутів; вміст створеної користувачем новини на production-сервері не читався. Тимчасовий локальний сервер зупинено.

Довідка Next.js: https://nextjs.org/docs/messages/app-static-to-dynamic-error
