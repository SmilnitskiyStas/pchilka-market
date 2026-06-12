# Структура контент-сховища

## Принцип

У проєкті має бути два типи файлів:

- `public/...`
  для технічних або резервних статичних файлів, які майже не змінюються
- `/media/...`
  для всього бізнес-контенту, який може змінюватися без нового деплою

На production `media` фізично зберігається у постійній папці VPS:

`/srv/pchilka-app/data/app/uploads`

Ця папка вже підключена в Docker через volume, тому контент не втрачається після перевипуску контейнерів.

## Як працює доступ

- файли завантажуються в uploads-каталог на сервері
- сайт віддає їх через маршрут `GET /media/...`
- для зображень, PDF, відео й документів не потрібен новий build

## Що класти в `/media`

- логотипи та інші бренд-матеріали
- банери головної сторінки
- зображення акцій і товарів
- обкладинки статей
- PDF-каталоги
- відео
- вкладення з форм

## Що лишати в `public`

- favicon та `icon.png`
- запасні дефолтні картинки
- рідко змінювані технічні ресурси

## Рекомендована структура папок

```txt
/media/branding/logo/<year>/<month>/<file>
/media/branding/icons/<year>/<month>/<file>
/media/banners/home/<year>/<month>/<file>
/media/promotions/shock-price/<year>/<month>/<file>
/media/promotions/catalogs/<year>/<month>/<file>
/media/blog/covers/<year>/<month>/<file>
/media/blog/gallery/<year>/<month>/<file>
/media/own-brand/<year>/<month>/<file>
/media/video/<year>/<month>/<file>
/media/forms/<feature>/<year>/<month>/<file>
```

## Поточні API

### 1. Зображення

`POST /api/admin/images`

Підходить для завантаження зображень у адмінці.

Приклад папок:

- `admin/banners`
- `admin/content/covers`
- `admin/promotions/shock-price`

### 2. Універсальні assets

`POST /api/admin/assets`

Підходить для:

- зображень
- `.pdf`
- `.mp4`, `.webm`, `.mov`, `.m4v`
- `.doc`, `.docx`
- `.xls`, `.xlsx`
- `.txt`, `.json`
- `.svg`

Також є:

- `GET /api/admin/assets`
  повертає список уже завантажених assets у `/media/...`

## Поточне рішення для логотипу

Логотип сайту тепер можна зберігати як керований файл у:

`/media/branding/logo/...`

Його URL зберігається в налаштуваннях профілю сайту (`site_profile_v1`) і використовується в шапці сайту та на сторінці завантаження мобільного застосунку.

## Production-рекомендація

Для першого бойового запуску достатньо такої схеми:

- БД у Docker volume / bind mount
- uploads у `/srv/pchilka-app/data/app/uploads`
- регулярний backup БД
- регулярний backup uploads-папки

Це простіше й надійніше, ніж одразу переходити на зовнішнє S3-сховище.
