# 178 - Add telegram inventory intake flow

Date: 2026-04-15

Summary:
- updated Telegram `/start` flow so unregistered users receive a registration link and registered users receive a direct link to the inventory intake page;
- added public inventory intake page opened from Telegram with token validation, user/store context and product selection;
- added public inventory intake API to create a new product batch in the current user's store;
- linked created batches to the acting user through `responsible_user_id`, `created_by_user_id` and `updated_by_user_id`.

Verification:
- `npm run typecheck`
