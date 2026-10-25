# Mediateca

Videoteca y discoteca del usuario. Ver README.md para qué hace y cómo está montada.

- Siempre en castellano, también los nombres del código y los comentarios.
- La colección vive en `public/coleccion.json`. Nunca se sobrescribe ni se reimporta del Excel sin
  pedirlo: puede tener portadas y notas que el Excel no tiene.
- Publicar solo cuando lo pida («publica»). Repo previsto: `ElJuezHolden/mediateca`, en GitHub Pages.
- Commits firmados como `ElJuezHolden <elmaildeljuezholden@gmail.com>`, nunca con el nombre ni el
  correo personal. Para el push se cambia a la cuenta JuezHolden y luego se vuelve a Dlayse.
- Node puede no estar en el PATH: `set PATH=C:\Program Files\nodejs;%PATH%`.
- Servidor de desarrollo en el puerto 3340.
- Portadas: preferible ninguna a una equivocada. El buscador automático solo acepta coincidencias
  exactas y las marca con `portadaAuto` para revisarlas.
- Wikimedia da 429 a peticiones sin User-Agent identificable: el script pone uno con la URL del repo.
