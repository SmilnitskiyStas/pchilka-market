# Telegram reminders

The bot stores only tasks explicitly created with `/remind`; it does not retain regular group messages.

## One-time setup

1. Apply `docs/sql/038_create_telegram_reminders.sql` to the production MySQL database.
2. Add these values to the production environment (do not commit them):

```env
FUN_TELEGRAM_REMINDERS_SECRET=replace_with_a_long_random_value
FUN_TELEGRAM_REMINDERS_BASE_URL=https://pchilka-new.eatshock.com
```

3. Add a cron entry that runs once per minute from the project folder:

```cron
* * * * * /usr/bin/npm run fun-telegram:reminders >> /path/to/project/logs/fun-telegram-reminders.log 2>&1
```

Use the real absolute npm and project paths from the server. The task runner calls a protected site endpoint and sends all due reminders to their original group.

## Group commands

- `/remind 2026-08-01 09:00 Текст задачі` — create a reminder in Kyiv time.
- `/tasks` — show up to 20 active reminders created by the caller in the current group.
- `/done 12` — mark own reminder as completed.
- `/delete 12` — cancel own reminder.
