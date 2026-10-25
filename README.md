# Mediateca

**https://eljuezholden.github.io/mediateca/**

Tu videoteca y tu discoteca en una web: películas y series (DVD, Blu-ray, 4K, VHS) y música
(CD, vinilo, cassette, DVD). Cada cosa se ve con la forma de su caja real: la Amaray del DVD,
la caja azul y más baja del Blu-ray, la funda alta del VHS, la caja de plástico del CD con su
bisagra, el vinilo que asoma de la funda…

## Cómo funciona

- **La colección es un archivo:** `public/coleccion.json`, en el repo. Es lo que lee la web.
- **Se edita desde la web publicada,** en cualquier dispositivo. El candado de la cabecera abre
  «Acceso para editar»: se pega una vez el token de GitHub (y el de Discogs, para los discos) y
  aparecen añadir, editar, borrar y todo lo de Discogs. Cada cambio es un commit en el repo, firmado
  como ElJuezHolden, y la web pública se vuelve a publicar sola en 1-2 minutos. Quien edita lee la
  colección directamente de GitHub, así que ve sus cambios al momento.
- **Los tokens se quedan en ese navegador** (localStorage). «Salir en este navegador» los borra.
  El de GitHub conviene crearlo con acceso solo a este repo y solo a «Contents».
- **Sin acceso, la web es de solo lectura.**
- **También se puede editar en local:** `editar.cmd` (o `npm run dev`) se trae antes lo editado en
  la web (`git pull`) y abre http://localhost:3340, donde los cambios se guardan en el archivo y
  luego hay que hacer commit y push. Solo en local se detecta sola la foto del disco; en la web se
  elige a mano entre las fotos de la edición.
- **Si se edita a la vez desde dos sitios,** el segundo en guardar recibe un aviso para recargar
  la página: así nunca se pisa un cambio.

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
  - **Discos:** iTunes, a 600 px, con el año; y detrás las ediciones físicas de Discogs y
    MusicBrainz (con país, formato y sello), que tienen los recopilatorios españoles y
    descatalogados. También se puede pegar el enlace de tu edición exacta en Discogs: pone su
    portada y su año, y la ficha enlaza a esa edición.
  - **Si no aparece:** clic derecho en cualquier imagen de Google → «Copiar dirección de imagen».
- **Portadas automáticas:** `npm run portadas` pone portada a todo lo que no la tenga, solo cuando
  casa sin duda. Quedan marcadas «por revisar»: en la ficha se confirman con un clic o se cambian.
  Hay filtros de «Portadas por revisar» y «Sin portada». Lo que acepta:
  - **Películas:** el mismo título, o el que da Wikipedia como título en España («The Silence of
    the Lambs (titulada El silencio de los corderos en España…)»). Si casan dos películas de años
    distintos (Titanic, Dumbo, El Rey León…), no pone ninguna.
  - **Discos:** el mismo artista y el mismo título, o un título que lo contiene entero con solo el
    nombre del artista o relleno de tienda de más («MTV Unplugged In New York», «Led Zeppelin II»).

## Discogs

Discogs solo da las imágenes con un token personal (gratis): discogs.com → Ajustes →
Desarrolladores → «Generar token». Se pega en `.env.local`, detrás de `DISCOGS_TOKEN=`
(hay un ejemplo en `.env.example`), y se reinicia `editar.cmd`.

- **El token no sale de tu ordenador:** `.env.local` está en `.gitignore`, y la web no llama a
  Discogs directamente sino a través del servidor local (`vite.config.ts`), que añade el token.
- **La web publicada no usa Discogs:** es de solo lectura y solo enseña las portadas ya guardadas.
- **Sin token** todo funciona igual, buscando solo en iTunes y MusicBrainz, y el formulario avisa.

### Vincular un disco con su edición

En el formulario de un disco, arriba del todo, se pega el enlace de la edición en Discogs
(`…/release/123456-…`; también vale un enlace de *master*, que lleva a su edición principal).
Al pegarlo se vincula solo:

- **Siempre trae:** portada, año, sello, nº de catálogo, país, géneros y las canciones con su
  duración (y su artista, en los recopilatorios).
- **Al añadir un disco nuevo** trae también artista, álbum, edición («2 x CD, Compilation…») y
  formato: basta con pegar el enlace y guardar.
- **En un disco que ya tenías** respeta cómo lo apuntaste y, si Discogs lo dice distinto, lo ofrece
  aparte: «En Discogs: Artista «Rammstein»» → *Usar estos* o *Dejar los míos*.
- **Elegir una portada de Discogs** con «Buscar» también vincula esa edición.
- **Sin el enlace a mano:** «Elegir de la lista» enseña todas las ediciones del disco en Discogs
  (país, año, formato, sello, nº de catálogo) y se marca la tuya. Desde la ficha, «Vincular con
  Discogs» o «¿No es tu edición?» abren el formulario con esa lista ya abierta.
- **Foto del disco:** entre las fotos de la edición se busca la del CD o el vinilo (un círculo
  grande sobre fondo liso, lo analiza `scripts/foto-disco.ts` con sharp en el servidor local) y es
  lo que sale de la caja en la animación. Si no la encuentra, o se equivoca, el botón de fotos de
  la edición deja elegir a mano cuál es la portada y cuál el disco.
- Una vez vinculado: ver la edición en Discogs, volver a traer los datos, cambiar de edición o
  desvincular.
- En la ficha salen el sello, el país, los géneros y la lista de canciones con la duración total, y
  el buscador encuentra los discos también por sello, nº de catálogo o por una canción.
- `npm run discogs` completa con todos esos datos (y la foto del disco) los discos vinculados a los que les falten
  (`-- --todos` los vuelve a traer todos).

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
