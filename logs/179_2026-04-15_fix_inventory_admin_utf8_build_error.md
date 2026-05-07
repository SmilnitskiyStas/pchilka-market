# 179 - Fix inventory admin UTF-8 build error

Date: 2026-04-15

Summary:
- rewrote `components/admin/admin-inventory-manager.tsx` in valid UTF-8 to remove webpack build failure;
- rewrote `app/admin/inventory/page.tsx` in clean UTF-8 and restored readable metadata strings;
- verified that `npm run build` now finishes successfully.

Notes:
- `npm run typecheck` currently fails because `tsconfig.json` includes stale `.next/types/**/*.ts` entries that no longer exist in the workspace.

Verification:
- `npm run build`
