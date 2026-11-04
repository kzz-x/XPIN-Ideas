@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js, then run this file again.
  pause
  exit /b 1
)
start "LingGan Preview" /b node server.mjs 4188
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:4188
