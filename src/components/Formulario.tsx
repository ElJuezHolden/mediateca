import { useEffect, useState } from 'react';
import { Disc3, ExternalLink, Link2, Link2Off, Loader2, RefreshCw, Search, X } from 'lucide-react';
import {
  avisoDiscogs,
  buscarDisco,
  buscarPelicula,
  desvincularDiscogs,
  edicionDiscogs,
  vincularDiscogs,
  type Candidata,
  type EdicionDiscogs,
} from '../portadas';
import { FORMATOS, SECCIONES, type Item } from '../types';
import { Portada } from './Portada';

interface Props {
  item: Item;
  nuevo: boolean;
  /** Para sugerir artistas ya apuntados al escribir. */
  artistas: string[];
  onGuardar: (item: Item) => void;
  onCancelar: () => void;
}

export function Formulario({ item, nuevo, artistas, onGuardar, onCancelar }: Props) {
  const [b, setB] = useState<Item>(item);
  const [candidatas, setCandidatas] = useState<Candidata[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [enlaceDiscogs, setEnlaceDiscogs] = useState('');
  const [cargandoDiscogs, setCargandoDiscogs] = useState(false);
  /** La última edición vinculada, para ofrecer sus datos si difieren de los tuyos. */
  const [vinculada, setVinculada] = useState<EdicionDiscogs | null>(null);
  const [cambiandoEdicion, setCambiandoEdicion] = useState(false);
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
      setEnlaceDiscogs('');
      setCambiandoEdicion(false);
    } catch (e) {
      setError(`Discogs: ${e instanceof Error ? e.message : e}`);
    } finally {
      setCargandoDiscogs(false);
    }
  }

  // Lo que Discogs dice distinto de lo apuntado, para poder usarlo con un clic.
  const diferencias = vinculada
    ? (
        [
          ['artista', 'Artista'],
          ['titulo', 'Álbum'],
          ['edicion', 'Edición'],
          ['formato', 'Formato'],
        ] as const
      ).filter(([k]) => vinculada[k] && vinculada[k] !== b[k])
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
                    <p className="mt-1.5 text-xs text-[var(--suave)]">
                      {nuevo ? 'Se rellena todo: ' : 'Trae '}portada, año, sello, nº de catálogo, país, géneros y canciones.
                    </p>
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
