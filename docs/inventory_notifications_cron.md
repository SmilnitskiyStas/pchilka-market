# Inventory Notifications Automation

## Purpose
- Send Telegram expiry notifications automatically every day at `07:00` Kyiv time.
- Keep manual trigger from admin inventory page.

## Available modes

### 1. Built-in auto-run in `start-next.cjs`
Used when the app is started with:

```bash
npm start
```

Behavior:
- scheduler checks Kyiv time inside the Node process
- at `07:00` it calls `POST /api/inventory/notifications/run`
- can be disabled with `INVENTORY_NOTIFICATIONS_AUTO_RUN=0`

Required env:
- `INVENTORY_NOTIFY_SECRET`
- `INVENTORY_NOTIFY_BASE_URL` or `SITE_URL`
- `PORT` only if no base URL is set and local fallback is used

### 2. External cron
Can still be used if you prefer explicit OS-level scheduling.

Manual run:

```bash
node run-inventory-notifications.cjs
```

Cron example if server timezone is already Kyiv:

```cron
0 7 * * * cd /path/to/project && /usr/bin/node run-inventory-notifications.cjs >> /path/to/project/logs/inventory-notify-cron.log 2>&1
```

If server timezone is not Kyiv:

```cron
0 7 * * * TZ=Europe/Kiev cd /path/to/project && /usr/bin/node run-inventory-notifications.cjs >> /path/to/project/logs/inventory-notify-cron.log 2>&1
```

## Notes
- Web app must already be running on `127.0.0.1:$PORT`.
- Notification runner uses `INVENTORY_NOTIFY_BASE_URL`, then `SITE_URL`, then falls back to `http://127.0.0.1:$PORT`.
- Endpoint `POST /api/inventory/notifications/run` requires header `x-inventory-notify-secret`.
- Manual admin trigger still works through `/api/admin/inventory/notifications/run`.
