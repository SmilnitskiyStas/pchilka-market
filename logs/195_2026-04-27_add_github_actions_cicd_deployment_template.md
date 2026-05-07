# 195. Add GitHub Actions CI/CD deployment template

Дата: 2026-04-27

## Зроблено

- Додано `.github/workflows/deploy.yml`.
- Workflow запускається після `push` у `main` або вручну через `workflow_dispatch`.
- Перед deploy виконується перевірка:
  - `npm ci`
  - `npm run build`
- Deploy виконується через SSH на production-сервер:
  - `git fetch --all --prune`
  - `git checkout main`
  - `git pull --ff-only origin main`
  - `npm ci`
  - `npm run build`
  - restart command з GitHub Secrets.
- Додано документацію `docs/deployment_cicd.md` з переліком GitHub Secrets і одноразовими діями на сервері.

## Потрібно налаштувати поза репозиторієм

- Додати GitHub Secrets для production-сервера.
- Переконатися, що репозиторій клоновано на сервер у `PRODUCTION_APP_DIR`.
- Налаштувати процес-менеджер на сервері (`pm2`, `systemd` або поточний варіант запуску).
- Вказати правильну команду restart у `PRODUCTION_RESTART_COMMAND`.

## Перевірка

- Переглянуто створені workflow і документацію.
- Реальний deploy не запускався, бо потрібні production SSH-доступи і GitHub Secrets.
