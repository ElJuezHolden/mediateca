import { useEffect, useState } from 'react';
import { Disc3, ExternalLink, Images, Link2, Link2Off, List, Loader2, RefreshCw, Search, X } from 'lucide-react';
import {
  avisoDiscogs,
  buscarDisco,
  buscarPelicula,
  desvincularDiscogs,
  edicionDiscogs,
  edicionesDiscogs,
  normalizar,
  vincularDiscogs,
  type Candidata,
  type EdicionDiscogs,
  type OpcionEdicion,
} from '../portadas';
import { FORMATOS, SECCIONES, type Item } from '../types';
import { Portada } from './Portada';

interface Props {
  item: Item;
  nuevo: boolean;
  /** Abrir directamente la lista de ediciones de Discogs para elegir la tuya. */
  elegirEdicion?: boolean;
  /** Para sugerir artistas ya apuntados al escribir. */
  artistas: string[];
  onGuardar: (item: Item) => void;
  onCancelar: () => void;
}

export function Formulario({ item, nuevo, elegirEdicion, artistas, onGuardar, onCancelar }: Props) {
  const [b, setB] = useState<Item>(item);
  const [candidatas, setCandidatas] = useState<Candidata[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [enlaceDiscogs, setEnlaceDiscogs] = useState('');
  const [cargandoDiscogs, setCargandoDiscogs] = useState(false);
  /** La última edición vinculada, para ofrecer sus datos si difieren de los tuyos. */
  const [vinculada, setVinculada] = useState<EdicionDiscogs | null>(null);
  const [cambiandoEdicion, setCambiandoEdicion] = useState(false);
  /** Las ediciones del disco en Discogs, para elegir la tuya de la lista. */
  const [ediciones, setEdiciones] = useState<OpcionEdicion[] | null>(null);
  const [cargandoEdiciones, setCargandoEdiciones] = useState(false);
  /** Las fotos de la edición vinculada, para elegir portada y disco a mano. */
  const [fotos, setFotos] = useState<string[] | null>(null);
  const musica = b.seccion === 'discoteca';

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCancelar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  const cambiar = <K extends keyof Item>(k: K, v: Item[K]) => setB((x) => ({ ...x, [k]: v }));
  const texto = (k: 'titulo' | 'artista' | 'director' | 'edicion' | 'notas' | 'portada' | 'sello' | 'catalogo' | 'pais') => ({
    value: b[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      cambiar(k, e.target.value);
      if (k === 'portada') cambiar('portadaAuto', undefined);
    },
  });

  async function buscar() {
    if (!b.titulo.trim()) return;
    setBuscando(true);
    setError('');
    try {
      setCandidatas(musica ? await buscarDisco(b.artista, b.titulo) : await buscarPelicula(b.titulo));
    } catch (e) {
      setError(`No se pudo buscar: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBuscando(false);
    }
  }

  function elegir(c: Candidata) {
    // Si la portada era automática, el año y la dirección venían de ella y se
    // cambian con la nueva; si no, solo se rellenan los que falten.
    const reemplazar = item.portadaAuto;
    setB((x) => ({
      ...x,
      portada: c.url,
      portadaAuto: undefined,
      anio: reemplazar ? (c.anio ?? x.anio) : (x.anio ?? c.anio),
      director: musica ? x.director : reemplazar ? (c.director ?? x.director) : (x.director ?? c.director),
    }));
    setCandidatas(null);
    // Una portada de Discogs dice qué edición es: se vincula con todos sus datos.
    if (c.discogs) vincular(String(c.discogs));
  }

  async function vincular(enlace: string) {
    if (!enlace.trim()) return;
    setCargandoDiscogs(true);
    setError('');
    try {
      const e = await edicionDiscogs(enlace);
      // En un disco nuevo se trae todo; en uno que ya tenías, se respeta cómo
      // lo apuntaste y se ofrece lo de Discogs aparte.
      setB((x) => vincularDiscogs(x, e, nuevo && !x.titulo.trim()));
      setVinculada(e);
      setFotos(e.imagenes.length > 1 ? e.imagenes : null);
      setEdiciones(null);
      setEnlaceDiscogs('');
      setCambiandoEdicion(false);
    } catch (e) {
      setError(`Discogs: ${e instanceof Error ? e.message : e}`);
    } finally {
      setCargandoDiscogs(false);
    }
  }

  async function cargarEdiciones() {
    if (!b.titulo.trim()) {
      setError('Discogs: escribe primero el álbum (y el artista) para ver sus ediciones.');
      return;
    }
    setCargandoEdiciones(true);
    setError('');
    try {
      setEdiciones(await edicionesDiscogs(b.artista, b.titulo));
    } catch (e) {
      setError(`Discogs: ${e instanceof Error ? e.message : e}`);
    } finally {
      setCargandoEdiciones(false);
    }
  }

  async function cargarFotos() {
    if (!b.discogs) return;
    setCargandoDiscogs(true);
    setError('');
    try {
      setFotos((await edicionDiscogs(String(b.discogs))).imagenes);
    } catch (e) {
      setError(`Discogs: ${e instanceof Error ? e.message : e}`);
    } finally {
      setCargandoDiscogs(false);
    }
  }

  /** Una foto elegida a mano como la del disco: se supone que lo llena. */
  function usarComoDisco(url: string, img: HTMLImageElement | null) {
    const proporcion = img?.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
    setB((x) => ({ ...x, fotoDisco: { url, x: 0.5, y: 0.5, r: Math.min(1, proporcion) / 2, proporcion } }));
  }

  // Desde la ficha («¿No es tu edición?»): la lista de ediciones, abierta.
  useEffect(() => {
    if (elegirEdicion && item.seccion === 'discoteca') cargarEdiciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lo que Discogs dice distinto de lo apuntado, para poder usarlo con un clic.
  const diferencias = vinculada
    ? (
        [
          ['artista', 'Artista'],
          ['titulo', 'Álbum'],
          ['edicion', 'Edición'],
          ['formato', 'Formato'],
        ] as const
      ).filter(([k]) => vinculada[k] && normalizar(vinculada[k]!) !== normalizar(b[k] ?? ''))
    : [];

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!b.titulo.trim()) return;
    // Fuera los campos vacíos, para que el JSON quede limpio.
    const limpio = Object.fromEntries(
      Object.entries(b)
        .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
        .filter(([, v]) => v !== '' && v !== undefined && v !== null),
    ) as unknown as Item;
    if (limpio.seccion !== 'discoteca') delete limpio.artista;
    onGuardar(limpio);
  }

  const etiqueta = 'mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--suave)]';

  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onCancelar()}>
      <form
        onSubmit={enviar}
        className="ventana relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--borde)] bg-[var(--panel)]"
      >
        <header className="flex items-center justify-between border-b border-[var(--borde)] px-5 py-3">
          <h2 className="font-display text-2xl tracking-wide">
            {nuevo ? `Añadir ${SECCIONES[b.seccion].singular}` : 'Editar'}
          </h2>
          <button type="button" className="rounded-full p-1.5 text-[var(--suave)] hover:text-white" onClick={onCancelar} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="grid gap-6 overflow-y-auto p-5 sm:grid-cols-[11rem_1fr]">
          <div className="mx-auto w-36 sm:w-full">
            <Portada item={b} />
          </div>

          <div className="grid gap-4">
            {nuevo && (
              <div className="flex gap-2">
                {(Object.keys(SECCIONES) as Item['seccion'][]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    aria-pressed={b.seccion === s}
                    onClick={() => setB((x) => ({ ...x, seccion: s, formato: FORMATOS[s][0] }))}
                  >
                    {SECCIONES[s].nombre}
                  </button>
                ))}
              </div>
            )}

            {musica && (
              <div className="rounded-xl border border-[var(--borde)] bg-[var(--fondo)] p-3">
                {b.discogs && !cambiandoEdicion ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link2 size={16} className="acento shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">Vinculado a Discogs</span>
                      <span className="block truncate text-xs text-[var(--suave)]">
                        {[b.sello, b.catalogo, b.pais, b.pistas?.length ? canciones(b.pistas.filter((p) => !p.cabecera).length) : '']
                          .filter(Boolean)
                          .join(' · ') || `Edición ${b.discogs}`}
                      </span>
                    </span>
                    <a
                      className="boton py-1"
                      href={`https://www.discogs.com/release/${b.discogs}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Ver en Discogs"
                      aria-label="Ver en Discogs"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      type="button"
                      className="boton py-1"
                      onClick={() => vincular(String(b.discogs))}
                      disabled={cargandoDiscogs}
                      title="Volver a traer los datos"
                      aria-label="Volver a traer los datos"
                    >
                      {cargandoDiscogs ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    </button>
                    <button
                      type="button"
                      className="boton py-1"
                      onClick={() => (fotos ? setFotos(null) : cargarFotos())}
                      title="Fotos de la edición"
                      aria-label="Fotos de la edición"
                    >
                      <Images size={14} />
                    </button>
                    <button type="button" className="boton py-1" onClick={() => setCambiandoEdicion(true)}>
                      Cambiar
                    </button>
                    <button
                      type="button"
                      className="boton py-1"
                      onClick={() => (setB((x) => desvincularDiscogs(x)), setVinculada(null))}
                      title="Desvincular"
                      aria-label="Desvincular"
                    >
                      <Link2Off size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        className="campo"
                        placeholder="Pega el enlace de tu edición en Discogs"
                        value={enlaceDiscogs}
                        autoFocus={cambiandoEdicion}
                        onChange={(e) => setEnlaceDiscogs(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), vincular(enlaceDiscogs))}
                        onPaste={(e) => {
                          // Al pegar un enlace se vincula sin tener que pulsar nada.
                          const pegado = e.clipboardData.getData('text');
                          if (/discogs\.com\/.*(release|master)\/\d+/.test(pegado)) {
                            e.preventDefault();
                            setEnlaceDiscogs(pegado);
                            vincular(pegado);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="boton shrink-0"
                        onClick={() => vincular(enlaceDiscogs)}
                        disabled={cargandoDiscogs || !enlaceDiscogs.trim()}
                      >
                        {cargandoDiscogs ? <Loader2 size={15} className="animate-spin" /> : <Disc3 size={15} />} Vincular
                      </button>
                      {cambiandoEdicion && (
                        <button type="button" className="boton shrink-0" onClick={() => setCambiandoEdicion(false)} aria-label="Cancelar">
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 text-xs text-[var(--suave)]">
                        {nuevo ? 'Se rellena todo: ' : 'Trae '}portada, año, sello, nº de catálogo, país, géneros y canciones.
                      </p>
                      <button type="button" className="boton py-1 text-xs" onClick={cargarEdiciones} disabled={cargandoEdiciones}>
                        {cargandoEdiciones ? <Loader2 size={13} className="animate-spin" /> : <List size={13} />} Elegir de la lista
                      </button>
                    </div>
                  </>
                )}
                {diferencias.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--borde)] pt-3 text-xs">
                    <span className="min-w-0 flex-1 text-[var(--suave)]">
                      En Discogs:{' '}
                      {diferencias.map(([k, nombre]) => (
                        <span key={k} className="mr-2 text-[var(--texto)]">
                          {nombre} «{vinculada![k]}»
                        </span>
                      ))}
                    </span>
                    <button
                      type="button"
                      className="boton py-1"
                      onClick={() => (setB((x) => vincularDiscogs(x, vinculada!, true)), setVinculada(null))}
                    >
                      Usar estos
                    </button>
                    <button type="button" className="boton py-1" onClick={() => setVinculada(null)}>
                      Dejar los míos
                    </button>
                  </div>
                )}
                {ediciones && (
                  <div className="mt-3 border-t border-[var(--borde)] pt-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-[var(--suave)]">
                      <span>
                        {ediciones.length
                          ? `${ediciones.length} ediciones en Discogs. Marca la tuya:`
                          : 'Discogs no tiene ediciones con ese artista y álbum. Prueba a corregirlos o pega el enlace.'}
                      </span>
                      <button type="button" className="p-1 hover:text-white" onClick={() => setEdiciones(null)} aria-label="Cerrar la lista">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--borde)]">
                      {ediciones.map((o) => (
                        <button
                          key={o.discogs}
                          type="button"
                          onClick={() => vincular(String(o.discogs))}
                          className={`grid w-full grid-cols-[2.5rem_1fr] items-center gap-3 border-b border-[var(--borde)] px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-[var(--panel-2)] ${
                            o.discogs === b.discogs ? 'bg-[var(--panel-2)]' : ''
                          }`}
                        >
                          <span className="h-10 w-10 overflow-hidden rounded bg-[var(--panel)]">
                            {o.miniatura && <img src={o.miniatura} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">
                              {o.titulo}
                              {o.discogs === b.discogs && <span className="acento"> · la tuya</span>}
                            </span>
                            <span className="block truncate text-[var(--suave)]">
                              {[o.pais, o.anio, o.formato].filter(Boolean).join(' · ')}
                            </span>
                            <span className="block truncate text-[var(--suave)]">{[o.sello, o.catalogo].filter(Boolean).join(' · ')}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {fotos && (
                  <div className="mt-3 border-t border-[var(--borde)] pt-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-[var(--suave)]">
                      <span>Fotos de la edición: elige la portada y la del disco (la que sale de la caja).</span>
                      <button type="button" className="p-1 hover:text-white" onClick={() => setFotos(null)} aria-label="Cerrar las fotos">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {fotos.map((url) => (
                        <div key={url} className="flex flex-col gap-1">
                          <img
                            src={url}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className={`aspect-square w-full rounded-md object-cover ${
                              url === b.portada || url === b.fotoDisco?.url ? 'ring-2 ring-[var(--acento)]' : ''
                            }`}
                          />
                          <div className="flex gap-1 text-[10px]">
                            <button
                              type="button"
                              className="chip flex-1 px-1 py-0.5 text-[10px]"
                              aria-pressed={url === b.portada}
                              onClick={() => setB((x) => ({ ...x, portada: url, portadaAuto: undefined }))}
                            >
                              Portada
                            </button>
                            <button
                              type="button"
                              className="chip flex-1 px-1 py-0.5 text-[10px]"
                              aria-pressed={url === b.fotoDisco?.url}
                              onClick={(e) =>
                                url === b.fotoDisco?.url
                                  ? setB((x) => ({ ...x, fotoDisco: undefined }))
                                  : usarComoDisco(url, e.currentTarget.parentElement?.previousElementSibling as HTMLImageElement)
                              }
                            >
                              Disco
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {error.startsWith('Discogs') && <p className="mt-2 text-sm text-red-400">{error}</p>}
              </div>
            )}

            {musica && (
              <label>
                <span className={etiqueta}>Artista</span>
                <input className="campo" list="artistas" {...texto('artista')} />
                <datalist id="artistas">
                  {artistas.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </label>
            )}

            <label>
              <span className={etiqueta}>{musica ? 'Álbum' : 'Película o serie'}</span>
              <input className="campo" required autoFocus={nuevo} {...texto('titulo')} />
            </label>

            <div>
              <span className={etiqueta}>Formato</span>
              <div className="flex flex-wrap gap-2">
                {FORMATOS[b.seccion].map((f) => (
                  <button key={f} type="button" className="chip" aria-pressed={b.formato === f} onClick={() => cambiar('formato', f)}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
              <label>
                <span className={etiqueta}>Edición</span>
                <input
                  className="campo"
                  placeholder={musica ? '2 x CD, Compilation, Digipak' : 'Ed Especial 2 DVD'}
                  {...texto('edicion')}
                />
              </label>
              <label>
                <span className={etiqueta}>Año</span>
                <input
                  className="campo"
                  inputMode="numeric"
                  value={b.anio ?? ''}
                  onChange={(e) => cambiar('anio', e.target.value ? Number(e.target.value.replace(/\D/g, '')) || undefined : undefined)}
                />
              </label>
            </div>

            {musica && (
              <div className="grid gap-4 sm:grid-cols-3">
                <label>
                  <span className={etiqueta}>Sello</span>
                  <input className="campo" {...texto('sello')} />
                </label>
                <label>
                  <span className={etiqueta}>Nº de catálogo</span>
                  <input className="campo" {...texto('catalogo')} />
                </label>
                <label>
                  <span className={etiqueta}>País</span>
                  <input className="campo" {...texto('pais')} />
                </label>
              </div>
            )}

            {!musica && (
              <label>
                <span className={etiqueta}>Dirección</span>
                <input className="campo" {...texto('director')} />
              </label>
            )}

            <div>
              <span className={etiqueta}>Portada (URL de la imagen)</span>
              <div className="flex gap-2">
                <input className="campo" type="url" placeholder="https://…" {...texto('portada')} />
                <button type="button" className="boton shrink-0" onClick={buscar} disabled={buscando}>
                  {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
                </button>
              </div>
              {error && !error.startsWith('Discogs') && <p className="mt-2 text-sm text-red-400">{error}</p>}
              {candidatas && (
                <div className="mt-3 rounded-xl border border-[var(--borde)] bg-[var(--fondo)] p-3">
                  {musica && avisoDiscogs() && (
                    <p className="mb-3 text-xs text-amber-300">
                      Sin Discogs: {avisoDiscogs().includes('DISCOGS_TOKEN') ? 'falta tu token en el archivo .env.local.' : avisoDiscogs()}
                    </p>
                  )}
                  {candidatas.length === 0 ? (
                    <p className="text-sm text-[var(--suave)]">
                      Sin resultados en {musica ? 'iTunes, Discogs ni MusicBrainz' : 'Wikipedia'}. Busca la imagen en Google, haz clic derecho → «Copiar
                      dirección de imagen» y pégala arriba.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {candidatas.map((c) => (
                        <button key={c.url} type="button" onClick={() => elegir(c)} className="group text-left" title={c.detalle}>
                          <img
                            src={c.url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className={`w-full rounded-md object-cover ring-[var(--acento)] group-hover:ring-2 ${musica ? 'aspect-square' : 'aspect-[2/3]'}`}
                          />
                          <span className="mt-1 line-clamp-2 block text-xs leading-tight">{c.titulo}</span>
                          <span className="block text-[11px] text-[var(--suave)]">
                            {[c.anio, c.fuente].filter(Boolean).join(' · ')}
                          </span>
                          {musica && <span className="block truncate text-[11px] text-[var(--suave)]">{c.detalle}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <label>
              <span className={etiqueta}>Notas</span>
              <textarea className="campo min-h-20" placeholder="Estado, lo que le falta, dónde lo compraste…" {...texto('notas')} />
            </label>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--borde)] px-5 py-3">
          <button type="button" className="boton" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="submit" className="boton boton-acento">
            Guardar
          </button>
        </footer>
      </form>
    </div>
  );
}

const canciones = (n: number) => `${n} ${n === 1 ? 'canción' : 'canciones'}`;
