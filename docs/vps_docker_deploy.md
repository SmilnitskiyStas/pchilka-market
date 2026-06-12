# Підготовка деплою на VPS через Docker Compose

Цей файл описує базову production-схему запуску проєкту на підготовленому VPS.

## Що вже підготовлено на сервері

- створено `swap` 4G
- встановлено `Docker Engine`
- встановлено `Docker Compose`
- створено базову структуру директорій:
  - `/srv/pchilka-app/app`
  - `/srv/pchilka-app/compose`
  - `/srv/pchilka-app/env`
  - `/srv/pchilka-app/data/app`
  - `/srv/pchilka-app/data/db`
  - `/srv/pchilka-app/data/nginx`
  - `/srv/pchilka-app/backups`
  - `/srv/pchilka-app/logs`

## Файли в репозиторії

- `Dockerfile`
- `.dockerignore`
- `docker-compose.production.yml`
- `.env.docker.example`

## Запланована схема

- `app`:
  Next.js застосунок у контейнері
- `db`:
  MySQL 8.4 у контейнері
- `uploads`:
  окремий volume/host path
- `nginx`:
  поточний системний nginx на VPS надалі має проксувати трафік на `127.0.0.1:3000`

## Що треба зробити перед запуском

1. Скопіювати код проєкту на сервер у `/srv/pchilka-app/app`
2. Створити на сервері `.env.docker` на основі `.env.docker.example`
3. Вирішити питання імпорту структури нової БД
4. Вирішити, чи переносимо старі медіафайли WordPress у новий застосунок
5. Підготувати production `nginx` конфіг для:
   - `pchilka-market.ua`
   - `www.pchilka-market.ua`

## Базовий запуск

```bash
cd /srv/pchilka-app/compose
docker compose -f docker-compose.production.yml up -d --build
```

## Перевірка

```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f app
docker compose -f docker-compose.production.yml logs -f db
```

## Важливо

- поточний бойовий WordPress поки не вимикаємо, доки новий стек не перевірений
- `www.pchilka-market.ua` зараз налаштований некоректно, це треба виправити під час фінального `nginx` cutover
