// Búsqueda de portadas sin claves de API, la usa tanto la web como
// scripts/buscar-portadas.ts:
//  - Películas: Wikipedia. Se busca el título en la española (que es como
//    están apuntadas) y se coge el póster del artículo en inglés, porque la
//    española solo admite imágenes libres y no tiene carteles.
//  - Discos: la API de búsqueda de iTunes, con portadas a 600 px.

export interface Candidata {
  url: string;
  /** Título tal cual viene de la fuente, para comparar con el apuntado. */
  titulo: string;
  artista?: string;
  detalle?: string;
  anio?: number;
  director?: string;
  fuente: 'Wikipedia' | 'iTunes';
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

async function api(url: string, params: Record<string, string>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  // Wikipedia e iTunes devuelven 429 o 403 si se les pide mucho seguido:
  // se espera y se reintenta un par de veces.
  for (let intento = 0; ; intento++) {
    const r = await fetch(u, { headers: cabeceras });
    if (r.ok) return r.json();
    if (intento >= 3 || (r.status !== 429 && r.status !== 403 && r.status < 500)) {
      throw new Error(`${u.host}: HTTP ${r.status}`);
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

export async function buscarPelicula(titulo: string): Promise<Candidata[]> {
  const q = tituloParaBuscar(titulo);
  const [es, enBusqueda] = await Promise.all([
    wiki('es', {
      generator: 'search',
      gsrsearch: `${q} película`,
      gsrlimit: '8',
      prop: 'langlinks|description|pageimages',
      lllang: 'en',
      lllimit: '50',
      piprop: 'thumbnail',
      pithumbsize: '500',
      pilicense: 'any',
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

const VARIOS = /^(varios|various|va)$/i;

export async function buscarDisco(artista: string | undefined, album: string): Promise<Candidata[]> {
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

/** Quita añadidos de las tiendas: «(Bonus Track Version)», «(Remastered)»… */
function tituloBase(titulo: string) {
  return normalizar(sinParentesis(titulo.replace(/\[.*?\]/g, ' '))).replace(/^(the|el|la|los|las) /, '');
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
  for (const c of candidatas) {
    const encontrado = tituloBase(c.titulo);
    if (item.seccion === 'discoteca') {
      const artista = normalizar(item.artista ?? '');
      const artistaOk =
        !artista || VARIOS.test(item.artista ?? '')
          ? true
          : normalizar(c.artista ?? '').includes(artista) || artista.includes(normalizar(c.artista ?? '') || '\u0000');
      if (artistaOk && encontrado === buscado) return c;
    } else if (encontrado === buscado) {
      // Dos películas con el mismo título y distinto año (remakes, la de
      // animación y la de imagen real…): no se puede saber cuál es.
      // Los resultados de respaldo solo cuentan si la elegida también lo es.
      const otra = candidatas.find(
        (o) => o !== c && o.anio && (c.respaldo || !o.respaldo) && tituloBase(o.titulo) === buscado && o.anio !== c.anio,
      );
      return otra ? null : c;
    }
  }
  return null;
}
