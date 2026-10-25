import { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { buscarDisco, buscarPelicula, type Candidata } from '../portadas';
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
  const musica = b.seccion === 'discoteca';

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCancelar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  const cambiar = <K extends keyof Item>(k: K, v: Item[K]) => setB((x) => ({ ...x, [k]: v }));
  const texto = (k: 'titulo' | 'artista' | 'director' | 'edicion' | 'notas' | 'portada') => ({
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
  }

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
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              {candidatas && (
                <div className="mt-3 rounded-xl border border-[var(--borde)] bg-[var(--fondo)] p-3">
                  {candidatas.length === 0 ? (
                    <p className="text-sm text-[var(--suave)]">
                      Sin resultados en {musica ? 'iTunes' : 'Wikipedia'}. Busca la imagen en Google, haz clic derecho → «Copiar
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
                            {[c.anio, musica ? c.artista : null].filter(Boolean).join(' · ')}
                          </span>
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
