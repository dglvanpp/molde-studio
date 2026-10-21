@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js 22.12 o posterior. Instala la version LTS desde nodejs.org.
  pause
  exit /b 1
)
echo Abre http://127.0.0.1:4173/ en tu navegador.
node scripts/serve.mjs
pause
