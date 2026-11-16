@echo off
REM One-click build: creates the Windows 11 installer + portable .exe in the "release" folder.
REM Requires Node.js 20+ (https://nodejs.org) and an internet connection for the first run.
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js is not installed. Install it from https://nodejs.org ^(LTS^), restart this window, then run again. & pause & exit /b 1)
call npm install || goto :err
call npm run dist:win || goto :err
echo.
echo Done. Your installer and portable exe are in the "release" folder.
explorer release
exit /b 0
:err
echo Build failed. See messages above.
pause
exit /b 1
