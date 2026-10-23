@echo off
setlocal
cd /d "%~dp0"
node scripts\sync-loyalty-rule-analytics.mjs %*
exit /b %errorlevel%