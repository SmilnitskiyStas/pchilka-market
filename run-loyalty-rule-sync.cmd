@echo off
setlocal
cd /d "%~dp0"
node scripts\sync-loyalty-rule-analytics.mjs %*
if errorlevel 1 (
  echo.
  echo Synchronization finished with an error. See logs\loyalty-rule-sync.log
  pause
  exit /b 1
)
echo.
echo Synchronization completed. See logs\loyalty-rule-sync.log
pause
