// Búsqueda de portadas sin claves de API, la usa tanto la web como
// scripts/buscar-portadas.ts:
//  - Películas: Wikipedia. Se busca el título en la española (que es como
//    están apuntadas) y se coge el póster del artículo en inglés, porque la
//    española solo admite imágenes libres y no tiene carteles.
//  - Discos: la API de búsqueda de iTunes, con portadas a 600 px; las ediciones
//    físicas de Discogs (necesita el token de .env.local) y las de MusicBrainz
//    con portada en el Cover Art Archive.

import type { Item, Pista } from './types.ts';

export interface Candidata {
  url: string;
  /** Título tal cual viene de la fuente, para comparar con el apuntado. */
  titulo: string;
  artista?: string;
  detalle?: string;
  anio?: number;
  director?: string;
  fuente: 'Wikipedia' | 'iTunes' | 'MusicBrainz' | 'Discogs';
  /** Id de la edición en Discogs, si salió de ahí. */
  discogs?: number;
  /** Otros títulos de la película (el de España, el original…), para comparar. */
  otrosTitulos?: string;
  /** Salió de la búsqueda de respaldo en la Wikipedia inglesa. */
  respaldo?: boolean;
}

/** Cabeceras extra; desde Node se pasa un User-Agent como pide Wikimedia. */
let cabeceras: Record<string, string> = {};
export function usarCabeceras(nuevas: Record<string, string>) {
  cabeceras = nuevas;
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // «S.A.» como «SA».
    .replace(/(?<=\b\w)\.(?=\w\b)/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Quita lo que no forma parte del título: temporadas, «serie completa»… */
export function tituloParaBuscar(titulo: string): string {
  return titulo
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(temp(orada)?\.?\s*\d+|\d+\s*a?\s*temp(orada)?\.?)\b/gi, ' ')
    .replace(/\bserie (completa|inedita|inédita)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sinParentesis(titulo: string) {
  return titulo.replace(/\s*\(.*?\)\s*/g, ' ').trim();
}

function sinQuery(url: string) {
  return url.split('?')[0];
}

async function api(url: string, params: Record<string, string>, extra: Record<string, string> = {}) {
  // Relativa en el navegador (/api/discogs, el servidor local).
  const u = new URL(url, globalThis.location?.href);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  // Wikipedia, iTunes y Discogs devuelven 429 o 403 si se les pide mucho
  // seguido: se espera y se reintenta un par de veces.
  for (let intento = 0; ; intento++) {
    const r = await fetch(u, { headers: { ...cabeceras, ...extra } });
    if (r.ok) return r.json();
    if (intento >= 3 || ![403, 429, 500, 502, 504].includes(r.status)) {
      throw new Error(`${u.host}: HTTP ${r.status}${r.status === 503 ? ` (${await r.text()})` : ''}`);
    }
    const espera = Number(r.headers.get('retry-after')) || 5 * (intento + 1);
    await new Promise((fin) => setTimeout(fin, Math.min(espera, 60) * 1000));
  }
}

interface PaginaWiki {
  index?: number;
  title: string;
  description?: string;
  thumbnail?: { source: string };
  langlinks?: { lang: string; '*': string }[];
  extract?: string;
}

function wiki(lang: 'es' | 'en', params: Record<string, string>) {
  return api(`https://${lang}.wikipedia.org/w/api.php`, {
    action: 'query',
    format: 'json',
    origin: '*',
    redirects: '1',
    ...params,
  });
}

const IMAGEN = { prop: 'pageimages|description', piprop: 'thumbnail', pithumbsize: '500', pilicense: 'any' };

function paginas(respuesta: { query?: { pages?: Record<string, PaginaWiki> } }): PaginaWiki[] {
  return Object.values(respuesta.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

function anioDe(texto?: string) {
  const m = texto?.match(/\b(18|19|20)\d{2}\b/);
  return m ? Number(m[0]) : undefined;
}

// Al principio de la descripción, para no coger personajes, novelas o bandas sonoras.
const ES_AUDIOVISUAL = /^(pel[ií]cula|serie(?! de (libros|novelas|historietas|c[oó]mics))|miniserie|telefilme|documental|anime|cortometraje|film)/i;
const EN_AUDIOVISUAL = /film|movie|series|television|animated|miniseries|documentary|anime/i;

/**
 * El arranque de la entradilla, hasta «es una película…»: ahí Wikipedia pone
 * los otros títulos, como «The Silence of the Lambs (titulada El silencio de
 * los corderos en España…)». Más allá ya habla de otras películas.
 */
function otrosTitulos(entradilla?: string) {
  if (!entradilla) return undefined;
  const fin = entradilla.search(/\b(es|fue) (una?|la|el)\b/);
  return entradilla.slice(0, fin > 0 ? fin : 300);
}

export async function buscarPelicula(titulo: string): Promise<Candidata[]> {
  const q = tituloParaBuscar(titulo);
  const [es, enBusqueda] = await Promise.all([
    wiki('es', {
      generator: 'search',
      gsrsearch: `${q} película`,
      gsrlimit: '8',
      prop: 'langlinks|description|pageimages|extracts',
      lllang: 'en',
      lllimit: '50',
      piprop: 'thumbnail',
      pithumbsize: '500',
      pilicense: 'any',
      exintro: '1',
      explaintext: '1',
      exlimit: 'max',
      exchars: '600',
    }),
    wiki('en', { generator: 'search', gsrsearch: `${q} film`, gsrlimit: '6', ...IMAGEN }),
  ]);

  const enEs = paginas(es).filter((p) => ES_AUDIOVISUAL.test(p.description ?? ''));
  const titulosEn = enEs.map((p) => p.langlinks?.[0]?.['*']).filter((t): t is string => !!t);
  const ingles = new Map<string, PaginaWiki>();
  if (titulosEn.length) {
    const r = await wiki('en', { titles: titulosEn.join('|'), ...IMAGEN });
    // Las redirecciones cambian el título: se apuntan los dos.
    const renombres = new Map<string, string>();
    for (const x of [...(r.query?.normalized ?? []), ...(r.query?.redirects ?? [])]) renombres.set(x.from, x.to);
    const porTitulo = new Map(paginas(r).map((p) => [p.title, p]));
    for (const t of titulosEn) {
      let final = t;
      while (renombres.has(final)) final = renombres.get(final)!;
      const p = porTitulo.get(final);
      if (p) ingles.set(t, p);
    }
  }

  const resultado: Candidata[] = [];
  const vistas = new Set<string>();
  for (const p of enEs) {
    const en = p.langlinks?.[0] ? ingles.get(p.langlinks[0]['*']) : undefined;
    const imagen = en?.thumbnail?.source ?? p.thumbnail?.source;
    if (en) vistas.add(en.title);
    if (!imagen) continue;
    resultado.push({
      url: sinQuery(imagen),
      titulo: sinParentesis(p.title),
      otrosTitulos: [otrosTitulos(p.extract), en ? sinParentesis(en.title) : ''].filter(Boolean).join(' · '),
      detalle: p.description,
      anio: anioDe(p.description),
      director: p.description?.match(/dirigid[ao] por (.+?)(?:\s+y\s+protagonizad.*)?$/i)?.[1],
      fuente: 'Wikipedia',
    });
  }
  // Títulos en inglés en el Excel («House on Haunted Hill», «Pi»…).
  for (const p of paginas(enBusqueda)) {
    if (vistas.has(p.title) || !p.thumbnail || !EN_AUDIOVISUAL.test(p.description ?? '')) continue;
    resultado.push({
      url: sinQuery(p.thumbnail.source),
      titulo: sinParentesis(p.title),
      detalle: p.description,
      anio: anioDe(p.description),
      director: p.description?.match(/\bby (.+)$/)?.[1],
      fuente: 'Wikipedia',
      respaldo: true,
    });
  }
  return resultado.filter((c, i) => resultado.findIndex((o) => o.url === c.url) === i);
}

interface AlbumItunes {
  collectionName: string;
  artistName: string;
  artworkUrl100?: string;
  releaseDate?: string;
  trackCount?: number;
}

const VARIOS = /^(varios|various|va|various artists)$/i;

async function buscarItunes(artista: string | undefined, album: string): Promise<Candidata[]> {
  const term = [artista && !VARIOS.test(artista) ? artista : '', album].join(' ').trim();
  const buscar = (country: string) =>
    api('https://itunes.apple.com/search', { term, entity: 'album', country, limit: '12' }).then(
      (r: { results: AlbumItunes[] }) => r.results,
    );
  let albumes = await buscar('ES');
  if (!albumes.length) albumes = await buscar('US');
  return albumes
    .filter((a) => a.artworkUrl100)
    .map((a) => ({
      url: a.artworkUrl100!.replace(/\/\d+x\d+bb\./, '/600x600bb.'),
      titulo: a.collectionName,
      artista: a.artistName,
      detalle: [a.artistName, a.trackCount ? `${a.trackCount} pistas` : ''].filter(Boolean).join(' · '),
      anio: anioDe(a.releaseDate),
      fuente: 'iTunes' as const,
    }));
}

interface EdicionMB {
  id: string;
  title: string;
  date?: string;
  country?: string;
  'artist-credit'?: { name: string; joinphrase?: string }[];
  media?: { format?: string }[];
}

const FORMATOS_MB: Record<string, string> = { 'Vinyl': 'Vinilo', '12" Vinyl': 'Vinilo', '7" Vinyl': 'Vinilo', 'Cassette': 'Cassette' };

/**
 * MusicBrainz tiene las ediciones físicas, también las españolas y las
 * descatalogadas que no están en iTunes. Las portadas son del Cover Art
 * Archive; solo se devuelven las ediciones que la tienen.
 */
async function buscarMusicBrainz(artista: string | undefined, album: string): Promise<Candidata[]> {
  const comillas = (t: string) => `"${t.replace(/["\\]/g, ' ')}"`;
  const partes = [`release:${comillas(album)}`];
  if (artista && !VARIOS.test(artista)) partes.push(`artist:${comillas(artista)}`);
  const r: { releases?: EdicionMB[] } = await api('https://musicbrainz.org/ws/2/release/', {
    query: partes.join(' AND '),
    fmt: 'json',
    limit: '25',
  });
  // Muchas ediciones del mismo disco: una por título, país y formato basta.
  const vistas = new Set<string>();
  const ediciones = (r.releases ?? []).filter((e) => {
    const clave = [normalizar(e.title), e.country, e.media?.[0]?.format].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
  const conPortada = await Promise.all(
    ediciones.slice(0, 8).map(async (e) => {
      try {
        const caa = await fetch(`https://coverartarchive.org/release/${e.id}`, { headers: cabeceras });
        if (!caa.ok) return null;
        const datos: { images: { front: boolean; image: string; thumbnails: Record<string, string> }[] } = await caa.json();
        const frontal = datos.images.find((i) => i.front);
        if (!frontal) return null;
        const credito = (e['artist-credit'] ?? []).map((a) => a.name + (a.joinphrase ?? '')).join('');
        const formato = e.media?.[0]?.format;
        return {
          url: (frontal.thumbnails['500'] ?? frontal.thumbnails.large ?? frontal.image).replace(/^http:/, 'https:'),
          titulo: e.title,
          artista: credito,
          detalle: [credito, e.country, formato ? (FORMATOS_MB[formato] ?? formato) : ''].filter(Boolean).join(' · '),
          anio: anioDe(e.date),
          fuente: 'MusicBrainz' as const,
        };
      } catch {
        return null;
      }
    }),
  );
  return conPortada.filter((c): c is NonNullable<typeof c> => c !== null);
}

// Discogs: en el navegador se pide al servidor local, que pone el token; desde
// el script se llama directamente con el token de .env.local.
let discogsBase = '/api/discogs';
let discogsCabeceras: Record<string, string> = {};
export function usarTokenDiscogs(token: string) {
  discogsBase = 'https://api.discogs.com';
  discogsCabeceras = { Authorization: `Discogs token=${token}` };
}

interface ResultadoDiscogs {
  id: number;
  type: string;
  title: string;
  year?: string;
  country?: string;
  format?: string[];
  label?: string[];
  cover_image?: string;
}

/** «Camela (2)» → «Camela»: Discogs numera a los artistas con el mismo nombre. */
const sinNumero = (t: string) => t.replace(/\s*\(\d+\)/g, '').replace(/\*$/, '').trim();

function candidataDiscogs(r: ResultadoDiscogs): Candidata | null {
  // Las imágenes vacías de Discogs son un «spacer.gif».
  if (!r.cover_image || r.cover_image.endsWith('.gif')) return null;
  const corte = r.title.indexOf(' - ');
  const artista = corte > 0 ? sinNumero(r.title.slice(0, corte)) : undefined;
  const titulo = corte > 0 ? r.title.slice(corte + 3) : r.title;
  return {
    url: r.cover_image,
    titulo,
    artista,
    detalle: [artista, r.country, r.format?.slice(0, 2).join(', '), r.label?.[0]].filter(Boolean).join(' · '),
    anio: r.year ? Number(r.year) || undefined : undefined,
    fuente: 'Discogs',
    discogs: r.id,
  };
}

async function buscarDiscogs(artista: string | undefined, album: string): Promise<Candidata[]> {
  const buscar = (params: Record<string, string>) =>
    api(`${discogsBase}/database/search`, { type: 'release', per_page: '15', ...params }, discogsCabeceras).then(
      (r: { results: ResultadoDiscogs[] }) => r.results,
    );
  const porArtista = artista && !VARIOS.test(artista);
  let resultados = await buscar(porArtista ? { artist: artista, release_title: album } : { release_title: album });
  if (!resultados.length) resultados = await buscar({ q: [porArtista ? artista : '', album].join(' ').trim() });
  const vistas = new Set<string>();
  return resultados
    .map(candidataDiscogs)
    .filter((c): c is Candidata => !!c && !vistas.has(c.url) && !!vistas.add(c.url));
}

/** Todo lo que se trae de una edición de Discogs al vincularla. */
export interface EdicionDiscogs {
  discogs: number;
  portada?: string;
  titulo: string;
  artista?: string;
  anio?: number;
  formato?: string;
  /** Al estilo de Discogs y del Excel: «2 x CD, Compilation, Digipak». */
  edicion?: string;
  sello?: string;
  catalogo?: string;
  pais?: string;
  generos?: string[];
  pistas?: Pista[];
}

const PAISES: Record<string, string> = {
  Spain: 'España', US: 'EE. UU.', UK: 'Reino Unido', Europe: 'Europa', Germany: 'Alemania', France: 'Francia',
  Italy: 'Italia', Japan: 'Japón', Mexico: 'México', Netherlands: 'Países Bajos', Portugal: 'Portugal',
  Argentina: 'Argentina', Colombia: 'Colombia', Venezuela: 'Venezuela', 'Puerto Rico': 'Puerto Rico',
  Brazil: 'Brasil', Canada: 'Canadá', Sweden: 'Suecia', Belgium: 'Bélgica', Australia: 'Australia',
  'UK & Europe': 'Reino Unido y Europa', 'USA & Canada': 'EE. UU. y Canadá', Worldwide: 'Todo el mundo',
};

/** El formato de Discogs pasado a los de la discoteca. */
function formatoDeDiscogs(nombre?: string) {
  const n = (nombre ?? '').toLowerCase();
  if (n.startsWith('cd') || n === 'sacd' || n === 'hybrid') return 'CD';
  if (n.includes('vinyl') || n === 'lp') return 'Vinilo';
  if (n.includes('cassette')) return 'Cassette';
  if (n.includes('dvd')) return 'DVD';
  if (n.includes('vhs')) return 'VHS';
  return undefined;
}

/**
 * El id de una edición a partir de lo que se pegue: el enlace
 * (…/release/123456-Artista-Titulo), «[r123456]» o el número a secas. Los
 * enlaces de un «master» llevan a su edición principal.
 */
async function idDeEdicion(enlace: string): Promise<number> {
  const edicion = enlace.match(/release\/(\d+)/)?.[1] ?? enlace.match(/^\s*\[?r?(\d+)\]?\s*$/i)?.[1];
  if (edicion) return Number(edicion);
  const master = enlace.match(/master\/(\d+)/)?.[1] ?? enlace.match(/^\s*\[m(\d+)\]\s*$/i)?.[1];
  if (master) {
    const m: { main_release: number } = await api(`${discogsBase}/masters/${master}`, {}, discogsCabeceras);
    return m.main_release;
  }
  throw new Error('No es un enlace de Discogs (…/release/123456…)');
}

/** Una edición concreta de Discogs, con todos sus datos, a partir de su enlace. */
export async function edicionDiscogs(enlace: string): Promise<EdicionDiscogs> {
  const id = await idDeEdicion(enlace);
  const r: {
    title: string;
    year?: number;
    country?: string;
    artists?: { name: string }[];
    images?: { type: string; uri: string }[];
    formats?: { name: string; qty?: string; descriptions?: string[]; text?: string }[];
    labels?: { name: string; catno?: string }[];
    genres?: string[];
    styles?: string[];
    tracklist?: { position?: string; title: string; duration?: string; type_?: string; artists?: { name: string }[] }[];
  } = await api(`${discogsBase}/releases/${id}`, {}, discogsCabeceras);

  const imagen = r.images?.find((i) => i.type === 'primary') ?? r.images?.[0];
  const artista = r.artists?.map((a) => sinNumero(a.name)).join(', ');
  const formatos = r.formats ?? [];
  // El formato principal ya va en su campo: en la edición solo se repite si
  // hay varios discos o varios formatos («2 x CD, DVD, Compilation»).
  const edicion = formatos
    .flatMap((f) => {
      const cantidad = Number(f.qty) || 1;
      const nombre = cantidad > 1 ? `${cantidad} x ${f.name}` : formatos.length > 1 ? f.name : '';
      return [nombre, ...(f.descriptions ?? []).filter((d) => d !== 'Album'), f.text ?? ''];
    })
    .filter(Boolean)
    .join(', ');
  const sello = r.labels?.find((l) => !/^not on label/i.test(l.name));
  const pistas = (r.tracklist ?? [])
    .filter((t) => t.type_ !== 'index')
    .map((t) => {
      const delArtista = t.artists?.map((a) => sinNumero(a.name)).join(', ');
      return {
        pos: t.position ?? '',
        titulo: t.title,
        ...(t.duration ? { duracion: t.duration } : {}),
        ...(delArtista && delArtista !== artista ? { artista: delArtista } : {}),
        ...(t.type_ === 'heading' ? { cabecera: true } : {}),
      };
    });

  return {
    discogs: id,
    portada: imagen?.uri,
    titulo: r.title,
    artista: artista && !/^various$/i.test(artista) ? artista : 'Varios',
    anio: r.year || undefined,
    formato: formatoDeDiscogs(formatos[0]?.name),
    edicion: edicion || undefined,
    sello: sello ? sinNumero(sello.name) : undefined,
    catalogo: sello?.catno && sello.catno !== 'none' ? sello.catno : undefined,
    pais: r.country ? (PAISES[r.country] ?? r.country) : undefined,
    generos: [...new Set([...(r.genres ?? []), ...(r.styles ?? [])])],
    pistas: pistas.length ? pistas : undefined,
  };
}

/**
 * Vincula un disco con su edición de Discogs. Siempre trae la portada, el año
 * y los datos de la edición (sello, catálogo, país, géneros, canciones); el
 * título, el artista, la edición y el formato solo si faltan o si se pide
 * `todo`, para no pisar cómo los tenías apuntados.
 */
export function vincularDiscogs<T extends Item>(item: T, e: EdicionDiscogs, todo = false): T {
  const vacio = (v: unknown) => v === undefined || v === '';
  return {
    ...item,
    discogs: e.discogs,
    ...(e.portada ? { portada: e.portada, portadaAuto: undefined } : {}),
    anio: e.anio ?? item.anio,
    sello: e.sello,
    catalogo: e.catalogo,
    pais: e.pais,
    generos: e.generos?.length ? e.generos : undefined,
    pistas: e.pistas,
    titulo: todo || vacio(item.titulo) ? e.titulo : item.titulo,
    artista: todo || vacio(item.artista) ? e.artista : item.artista,
    edicion: todo || vacio(item.edicion) ? e.edicion : item.edicion,
    formato: (todo || vacio(item.formato)) && e.formato ? e.formato : item.formato,
  };
}

/** Quita el vínculo con Discogs y los datos que venían de allí. */
export function desvincularDiscogs<T extends Item>(item: T): T {
  const { discogs: _d, sello: _s, catalogo: _c, pais: _p, generos: _g, pistas: _t, ...resto } = item;
  return resto as T;
}

let falloDiscogs = '';
/** Por qué falló Discogs en la última búsqueda de discos (vacío si fue bien). */
export function avisoDiscogs() {
  return falloDiscogs;
}

/**
 * Primero iTunes (portadas grandes y limpias); después las ediciones físicas
 * de Discogs y de MusicBrainz. Si una fuente falla, se sigue con las demás.
 */
export async function buscarDisco(artista: string | undefined, album: string): Promise<Candidata[]> {
  const [itunes, dg, mb] = await Promise.all([
    buscarItunes(artista, album).catch(() => []),
    buscarDiscogs(artista, album).then(
      (r) => ((falloDiscogs = ''), r),
      (e) => ((falloDiscogs = String(e instanceof Error ? e.message : e)), []),
    ),
    buscarMusicBrainz(artista, album).catch(() => []),
  ]);
  return [...itunes, ...dg, ...mb];
}

/** Quita añadidos de las tiendas: «(Bonus Track Version)», «(Remastered)»… */
function tituloBase(titulo: string) {
  return normalizar(sinParentesis(titulo.replace(/\[.*?\]/g, ' ')))
    .replace(/^(the|el|la|los|las) /, '')
    .replace(/\b(volume|volumen)\b/g, 'vol');
}

/** Palabras que las tiendas añaden al título sin que sea otro disco. */
const RELLENO = new Set(
  'mtv live en directo acoustic deluxe edition edicion expanded remastered remaster version special especial anniversary bonus track tracks album the original soundtrack ost banda sonora motion picture music from'.split(
    ' ',
  ),
);

/**
 * «MTV Unplugged In New York» por «Unplugged in New York», o «Led Zeppelin II»
 * por «II»: el título encontrado contiene el apuntado entero, y lo que sobra
 * es el nombre del artista o relleno de tienda.
 */
function contieneDisco(encontrado: string, buscado: string, artista: string) {
  const e = ` ${encontrado} `;
  if (!e.includes(` ${buscado} `)) return false;
  const delArtista = new Set(artista.split(' '));
  const sobra = e.replace(` ${buscado} `, ' ').trim().split(' ').filter(Boolean);
  return sobra.every((p) => RELLENO.has(p) || delArtista.has(p));
}

function mismoArtista(apuntado: string | undefined, encontrado: string | undefined) {
  if (!apuntado || VARIOS.test(apuntado)) return true;
  const a = normalizar(apuntado);
  const e = normalizar(encontrado ?? '');
  return !!e && (e.includes(a) || a.includes(e));
}

/**
 * La candidata que casa sin duda con lo apuntado, o null. La usa el buscador
 * automático, así que prefiere no poner portada a poner una equivocada.
 */
export function candidataSegura(
  item: { seccion: string; titulo: string; artista?: string },
  candidatas: Candidata[],
): Candidata | null {
  const buscado = tituloBase(tituloParaBuscar(item.titulo));
  if (!buscado) return null;

  if (item.seccion === 'discoteca') {
    const artista = normalizar(item.artista ?? '');
    const validas = candidatas.filter((c) => mismoArtista(item.artista, c.artista));
    return (
      validas.find((c) => tituloBase(c.titulo) === buscado) ??
      validas.find((c) => contieneDisco(tituloBase(c.titulo), buscado, artista)) ??
      null
    );
  }

  // Películas: por su título o por los otros con que se conoce (el de España,
  // el original…).
  // En los otros títulos tiene que venir seguido de «en España», «y…» o nada,
  // para que «Hermano oso 2 en España» no valga por «Hermano oso».
  const otro = new RegExp(`(^| )${buscado}( (en|y|o)( |$)|$)`);
  const casa = (c: Candidata) =>
    tituloBase(c.titulo) === buscado ||
    (!!c.otrosTitulos && c.otrosTitulos.split(' · ').some((t) => otro.test(normalizar(t))));
  const c = candidatas.find(casa);
  if (!c) return null;
  // Dos películas que casan con distinto año (remakes, la de animación y la de
  // imagen real…): no se puede saber cuál es. Los resultados de respaldo solo
  // cuentan si la elegida también lo es.
  const otra = candidatas.find((o) => o !== c && o.anio && o.anio !== c.anio && (c.respaldo || !o.respaldo) && casa(o));
  return otra ? null : c;
}
