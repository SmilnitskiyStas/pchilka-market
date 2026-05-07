# 210 — restore automatic inventory expiry notifications

## Problem
- expiry notification sending logic existed
- manual trigger endpoint existed
- helper script for local/cron trigger existed
- but current `start-next.cjs` no longer contained the automatic scheduler
- because of that, automatic daily delivery at 07:00 Kyiv time was not guaranteed

## Done
- restored built-in automatic scheduler in `start-next.cjs`
- scheduler runs every day at `07:00` in timezone `Europe/Kiev`
- scheduler calls `POST /api/inventory/notifications/run`
- scheduler uses `INVENTORY_NOTIFY_SECRET` or `INVENTORY_WEBHOOK_SECRET`
- added safe guards against duplicate same-day runs
- kept manual trigger support unchanged
- updated automation documentation

## Verification
- `node --check start-next.cjs`
- `cmd /c npm run build`

## Important env
- `INVENTORY_NOTIFY_SECRET`
- optional disable flag: `INVENTORY_NOTIFICATIONS_AUTO_RUN=0`
