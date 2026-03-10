@echo off
title PDF Editor
cd /d "%~dp0"
echo Starting PDF Editor...
echo.
echo Press Ctrl+C to stop the server.
echo.

:: Open browser after a short delay to give the dev server time to start
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

npm run dev
pause
