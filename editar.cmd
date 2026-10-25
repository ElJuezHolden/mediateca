@echo off
rem Abre la Mediateca en modo edición en este ordenador (los cambios se guardan
rem en public\coleccion.json). Antes se trae lo que se haya editado desde la web.
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
git pull --ff-only --quiet || echo No se pudo traer lo editado en la web: revisa que no haya cambios sin publicar.
start "" http://localhost:3340
npm run dev
