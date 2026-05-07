# 196. Add manual deploy sync command

Дата: 2026-04-27

## Зроблено

- Додано ручний deploy-скрипт `scripts/deploy-sync.ps1`.
- Додано npm-команду `npm run deploy:sync`.
- Додано шаблон конфігу `.deploy.example.json`.
- Додано `.deploy.local.json` у `.gitignore`, щоб реальні доступи до сервера не потрапили в репозиторій.
- Оновлено `docs/deployment_cicd.md`: основний поточний сценарій тепер ручна синхронізація командою.
- GitHub Actions workflow залишено тільки з ручним запуском `workflow_dispatch`, без автоматичного запуску по `push`.

## Як працює ручний deploy

1. Локально виконується `npm run build`.
2. Створюється архів коду без `.env*`, `.deploy.local.json`, `.git`, `.github`, `node_modules`, `.next`, `out`.
3. Архів завантажується на сервер через `scp`.
4. На сервері архів розпаковується в `appDir`.
5. На сервері запускається `npm ci`, `npm run build` і `restartCommand`.

## Перевірка

- PowerShell-синтаксис `scripts/deploy-sync.ps1` перевірено успішно.
- `cmd /c npm run build` - успішно.

## Залишилось

- Створити локальний `.deploy.local.json` на основі `.deploy.example.json`.
- Вказати реальні SSH-дані, шлях до застосунку на сервері і команду restart.
- Перший запуск `npm run deploy:sync` виконувати тільки після перевірки цих параметрів.
