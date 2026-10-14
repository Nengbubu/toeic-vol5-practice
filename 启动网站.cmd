@echo off
rem Serve the parent folder so the site can read the materials folder next to it.
cd /d "%~dp0"
for %%I in (.) do set "SITE=%%~nxI"
cd ..
where python >nul 2>nul || (echo Python not found. Install it from https://www.python.org/downloads/ & pause & exit /b 1)
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8080/%SITE%/"
echo TOEIC practice site: http://127.0.0.1:8080/%SITE%/  (close this window to stop)
python -m http.server 8080 --bind 127.0.0.1
