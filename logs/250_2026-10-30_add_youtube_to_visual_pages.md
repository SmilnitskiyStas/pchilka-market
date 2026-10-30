# YouTube у конструкторі сторінок

Дата: 2026-10-30.

На запит користувача відеоблок admin/pages доповнено підтримкою YouTube. Додано lib/youtube-video.ts із розбором watch, youtu.be, shorts, live та embed; перевіряються HTTPS, точний домен і ID відео. Рендерер будує канонічний iframe без довільних параметрів користувача, має адаптивні розміри, title, fullscreen і referrer policy. Звичайні відеофайли продовжують використовувати HTML video. Валідатор відхиляє помилкові YouTube-посилання, інтерфейс пояснює підтримані формати. Схема та вже збережені відеоблоки не змінювалися.

Оновлено docs/visual-page-editor.md та docs/site_content.md. Формат програвача звірено з офіційним https://developers.google.com/youtube/player_parameters.

Перевірки: scripts/check-visual-pages.cjs (реальний спільний рендерер preview/public, усі формати посилань, публікація і читання зі сховища тесту, URL-підміни й некоректні ID, MP4/WebM), TypeScript без incremental, git diff --check. Перевірки не записують у робочу БД й не завантажують відео.

Серверна збірка та розгортання не виконувалися. Сторонні зміни .gitignore і tsconfig.tsbuildinfo не включаються.
