# Mediateca

**https://eljuezholden.github.io/mediateca/**

Tu videoteca y tu discoteca en una web: películas y series (DVD, Blu-ray, 4K, VHS) y música
(CD, vinilo, cassette, DVD). Cada cosa se ve con la forma de su caja real: la Amaray del DVD,
la caja azul y más baja del Blu-ray, la funda alta del VHS, la caja de plástico del CD con su
bisagra, el vinilo que asoma de la funda…

## Cómo funciona

- **La colección es un archivo:** `public/coleccion.json`. Es lo que lee la web, en local y publicada.
- **Se edita en local.** Doble clic en `editar.cmd` (o `npm run dev`) abre http://localhost:3340 con
  los botones de añadir, editar y borrar. Cada cambio se guarda al momento en `coleccion.json`.
- **Se consulta en internet.** La versión publicada en GitHub Pages es de solo lectura. Para que
  salgan los cambios, se hace commit de `coleccion.json` y push (o se dice «publica»).

## Qué hace

- **Dos secciones:** Videoteca y Discoteca, cada una con su color.
- **Estantería o lista**, con separadores por letra (o por década si ordenas por año). En la
  discoteca, el orden por artista agrupa sus discos por año.
- **Orden sin artículos:** «El Rey León» va en la R y «The Beatles» en la B.
- **Buscador** por título, artista, director, edición, notas o año. Tecla `/` para ir a él.
- **Filtros por formato**, combinables.
- **Ficha** de cada título con enlaces a FilmAffinity, Wikipedia, Discogs o YouTube. Con ← y →
  se pasa al anterior o siguiente.
- **Portadas por URL**, con un buscador que propone candidatas:
  - **Películas:** Wikipedia. Se busca en la española y se coge el póster de la inglesa, porque
    la española no tiene carteles. Al elegir una, rellena el año y la dirección si faltaban.
  - **Discos:** iTunes, a 600 px, con el año; y detrás las ediciones físicas de MusicBrainz
    (con país y formato), que tienen muchos recopilatorios españoles y descatalogados.
  - **Si no aparece:** clic derecho en cualquier imagen de Google → «Copiar dirección de imagen».
- **Portadas automáticas:** `npm run portadas` pone portada a todo lo que no la tenga, solo cuando
  casa sin duda. Quedan marcadas «por revisar»: en la ficha se confirman con un clic o se cambian.
  Hay filtros de «Portadas por revisar» y «Sin portada». Lo que acepta:
  - **Películas:** el mismo título, o el que da Wikipedia como título en España («The Silence of
    the Lambs (titulada El silencio de los corderos en España…)»). Si casan dos películas de años
    distintos (Titanic, Dumbo, El Rey León…), no pone ninguna.
  - **Discos:** el mismo artista y el mismo título, o un título que lo contiene entero con solo el
    nombre del artista o relleno de tienda de más («MTV Unplugged In New York», «Led Zeppelin II»).

## Datos de cada título

| Campo | Videoteca | Discoteca |
|---|---|---|
| Título | Película o serie | Álbum |
| Artista | — | Sí |
| Dirección | Sí | — |
| Formato | DVD, Blu-ray, 4K UHD, VHS | CD, Vinilo, Cassette, DVD, VHS |
| Edición | Texto libre («Ed Especial 2 DVD») | Texto libre («2 x CD, Compilation, Digipak») |
| Año, portada, notas | Sí | Sí |

## Origen

Las hojas «Videoteca» y «Discoteca» de `Wishlist.xlsx`, importadas una vez con
`python scripts/importar-excel.py <ruta al xlsx>` (no sobrescribe sin `--forzar`).

## Tecnología

Vite 6, React 19, TypeScript y Tailwind 4, sin servidor propio. En local, un plugin de Vite
(`vite.config.ts`) recibe los cambios y escribe `coleccion.json`. `src/portadas.ts` lo usan
tanto la web como el script de portadas (Node 24 ejecuta TypeScript directamente).
