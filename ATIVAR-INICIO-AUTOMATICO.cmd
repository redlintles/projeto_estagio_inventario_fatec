@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\production-autostart.ps1" -Acao ativar
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
