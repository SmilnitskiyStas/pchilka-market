# 191 - Enable automatic 7am inventory notifications

## What changed
- Updated `start-next.cjs` with an in-process scheduler.
- Scheduler runs inventory expiry notification check automatically at `07:00` in timezone `Europe/Kiev`.
- Scheduler calls `POST /api/inventory/notifications/run`.
- Auto-run remains compatible with manual admin запуском з адмінки.
- Updated `app/api/inventory/notifications/run/route.ts` to accept notify secret from DB settings or env secret.

## Environment
- Auto-run is enabled by default.
- To disable:
  - `INVENTORY_NOTIFICATIONS_AUTO_RUN=0`
- Recommended env secret:
  - `INVENTORY_NOTIFY_SECRET=<same secret used for notification trigger>`

## Verification
- `cmd /c npm run build`
