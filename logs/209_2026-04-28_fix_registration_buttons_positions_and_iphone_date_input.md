# 209 — fix registration buttons, shared positions and iPhone date input

## Done
- changed Telegram registration flow so `/start` sends an inline button `Зареєструватися` instead of a plain URL
- added shared inventory position titles storage in `site_settings`
- registration context now returns available positions for a dropdown
- registration form now requires:
  - first name
  - surname
  - store
  - position
- added `Свій варіант` for custom position title
- custom position titles are normalized, deduplicated and saved into the shared list for future registrations
- improved intake date field UX:
  - auto-inserts dots while typing `dd.mm.yyyy`
  - keeps native `type=date` picker available through the calendar icon area on iPhone

## Files
- `lib/inventory-telegram-bot.ts`
- `lib/inventory-position-settings.ts`
- `lib/inventory-position-settings-repository.ts`
- `app/api/inventory/register/context/route.ts`
- `app/api/inventory/register/complete/route.ts`
- `app/inventory/register/page.tsx`
- `app/inventory/intake/page.tsx`
