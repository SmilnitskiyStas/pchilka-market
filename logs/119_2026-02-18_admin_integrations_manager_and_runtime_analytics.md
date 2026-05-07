# 119 / 2026-02-18 / admin_integrations_manager_and_runtime_analytics

## Що зроблено
- Замінено заглушку розділу `admin/integrations` на робочий менеджер налаштувань.
- Додано форму керування інтеграціями аналітики:
  - `enabled` (увімкнення/вимкнення)
  - `environment` (`prod` / `dev`)
  - `GA4 Measurement ID`
  - `GTM Container ID`
  - `Meta Pixel ID`
- Реалізовано валідацію форматів ідентифікаторів:
  - GA4: `G-...`
  - GTM: `GTM-...`
  - Meta Pixel: лише цифри
- Налаштування зберігаються в `localStorage` (`admin_integrations_settings_v1`).
- Додано runtime-підключення аналітики у публічній частині:
  - новий клієнтський компонент `AnalyticsLoader`
  - підключення в `app/layout.tsx`
  - динамічне інжектування скриптів GA4, GTM, Meta Pixel на основі налаштувань з адмінки.

## Перевірка
- Запущено `npm.cmd run typecheck`.
- Результат: без помилок.

## Що залишилось
- Перенести збереження налаштувань з `localStorage` у БД (Supabase) для серверного застосування.
- Додати керування `noscript` fallback для GTM/Meta Pixel за потреби хостингу/SEO вимог.
- Зафіксувати технічні вимоги до аналітики для production оточення.
