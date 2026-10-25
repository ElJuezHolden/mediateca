@echo off
rem Abre la Mediateca en modo edición (los cambios se guardan en public\coleccion.json).
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
start "" http://localhost:3340
npm run dev
