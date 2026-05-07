# 199. Hide public site chrome on inventory forms

Дата: 2026-04-27

## Зроблено

- Додано `app/inventory/layout.tsx`.
- Для сторінок `/inventory/*` приховано публічний `SiteHeader` і `SiteFooter`, щоб користувачі з Telegram бачили тільки робочі форми.
- Приховано `AnalyticsConsentBanner` на inventory-сторінках, щоб cookie-банер публічного сайту не заважав заповненню форм.
- Root layout залишено статичним, без `headers()`, щоб не переводити весь сайт у dynamic rendering.

## Перевірка

- `cmd /c npm run build` - успішно.
