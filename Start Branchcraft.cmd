@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 20 or newer, then reopen this launcher.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo Build this source checkout once: npm ci and npm run build
  pause
  exit /b 1
)
node bin\branchcraft.mjs --welcome --open
if errorlevel 1 pause
