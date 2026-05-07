# 175 - Add position and role to inventory registration

Date: 2026-04-14

Summary:
- added `users.position_title` to SQL schema and inventory migrations;
- extended Telegram/web registration flow to save user position and selected system role;
- updated inventory registration page with `Посада` and `Хто ви в системі` fields.

Verification:
- `npm run typecheck`
