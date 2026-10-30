# PDF у конструкторі сторінок та редакторі матеріалів

Дата: 2026-10-30.

На уточнення користувач обрав обидва редактори. Додано тип pdf (src/title), кнопку блоку, поля й валідацію в admin/pages. У admin/content додано кнопку PDF та панель вставлення в позицію курсора як Markdown-посилання. Спільний PdfMediaField підтримує upload PDF до 50 МБ, наявний assets API, пошук/пагінацію/оновлення каталогу та ручну адресу. Під час upload збереження/вставлення заблоковано; зберігається наявна модель media-повноважень.

PdfDocument в обох редакторах/публічних матеріалах показує iframe браузерного PDF-переглядача й постійне посилання відкриття в новій вкладці. Дозволено лише локальні або HTTPS URL із PDF-розширенням. ArticleBody розпізнає PDF URL/Markdown окремим рядком. Наявні контентні документи й файлові маршрути не мігрувалися; /media вже видає application/pdf.

Перевірки: scripts/check-pdf-documents.cjs — справжній upload із підписаною сесією у тимчасове сховище, відмова content-only, каталог, видача PDF/MIME та байтів, блок PDF у draft/published-рендері, валідація й Markdown; scripts/check-visual-pages.cjs — PDF у збереженій/опублікованій структурі, історії/відновленні та формах полів; scripts/check-page-content-rendering.cjs — вставлення PDF реальним клієнтським редактором та спільний рендер; scripts/check-media-order.cjs — нові PDF першими; TypeScript без incremental; git diff --check. Робоча БД і файли не змінювалися.

Оновлено docs/visual-page-editor.md, docs/site_content.md, docs/uploads_storage.md. Серверну збірку та розгортання не запускали. Сторонні .gitignore і tsconfig.tsbuildinfo не включаються.
