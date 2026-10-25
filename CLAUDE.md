# Mediateca

Videoteca y discoteca del usuario. Ver README.md para qué hace y cómo está montada.

- Siempre en castellano, también los nombres del código y los comentarios.
- La colección vive en `public/coleccion.json`. Nunca se sobrescribe ni se reimporta del Excel sin
  pedirlo: puede tener portadas y notas que el Excel no tiene.
- Publicar solo cuando lo pida («publica»). Repo: `ElJuezHolden/mediateca` (organización; la cuenta JuezHolden es admin), publicado en https://eljuezholden.github.io/mediateca/ con cada push a main.
- Commits firmados como `ElJuezHolden <elmaildeljuezholden@gmail.com>`, nunca con el nombre ni el
  correo personal. Para el push se cambia a la cuenta JuezHolden y luego se vuelve a Dlayse.
- Node puede no estar en el PATH: `set PATH=C:\Program Files\nodejs;%PATH%`.
- Servidor de desarrollo en el puerto 3340.
- Portadas: preferible ninguna a una equivocada. El buscador automático solo acepta coincidencias
  exactas y las marca con `portadaAuto` para revisarlas.
- Wikimedia da 429 a peticiones sin User-Agent identificable: el script pone uno con la URL del repo.
- Discogs: token del usuario en `.env.local` (ignorado por git). Claude no lo lee, no lo escribe ni lo muestra; la web lo usa solo a través del proxy local de `vite.config.ts`.
- La colección se edita sobre todo desde la web publicada (cada cambio es un commit en `main` hecho
  desde el navegador). Antes de tocar `public/coleccion.json` en local o de publicar, siempre
  `git pull --ff-only` (o `--rebase`) para no pisar lo editado en la web.
- Probar la versión publicada en local: `MSYS_NO_PATHCONV=1 BASE_PATH=/mediateca/ npm run build` y
  `npx vite preview --port 3341` (sin MSYS_NO_PATHCONV, Git Bash convierte la ruta base).
