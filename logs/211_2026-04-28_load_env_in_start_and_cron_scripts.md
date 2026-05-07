# 211 — load env in start and cron scripts

## Problem
- runtime on server started returning `Missing required env variable: DB_USER`
- this breaks DB-backed pages like `/admin/inventory`
- deployment/startup could depend too much on external shell env instead of explicitly loading project env files

## Done
- updated `start-next.cjs` to explicitly load Next env files before starting the app
- updated `run-inventory-notifications.cjs` to explicitly load env files too

## Result
- `npm start` is now less dependent on how the process manager exports env
- cron notification script can read `PORT` and `INVENTORY_NOTIFY_SECRET` from project env files as well
