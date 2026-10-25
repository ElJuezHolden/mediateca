import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Disc3, Film, LayoutGrid, List, Plus, Search, X } from 'lucide-react';
import { cargar, claveOrden, EDITABLE, guardar, nuevoId } from './datos';
import { normalizar } from './portadas';
import { FORMATOS, SECCIONES, type Coleccion, type Item, type Seccion } from './types';
import { Ficha } from './components/Ficha';
import { Formulario } from './components/Formulario';
import { Portada } from './components/Portada';

type Orden = 'nombre' | 'titulo' | 'anio' | 'anadido';
type Vista = 'estanteria' | 'lista';
type Revision = 'todas' | 'sin-portada' | 'por-revisar';

interface Preferencias {
  seccion: Seccion;
  vista: Vista;
  orden: Record<Seccion, Orden>;
}

const PREFS = 'mediateca-preferencias';
const PREFS_INICIALES: Preferencias = { seccion: 'videoteca', vista: 'estanteria', orden: { videoteca: 'nombre', discoteca: 'nombre' } };

function leerPreferencias(): Preferencias {
  try {
    return { ...PREFS_INICIALES, ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') };
  } catch {
    return PREFS_INICIALES;
  }
}

const ORDENES: Record<Seccion, { valor: Orden; nombre: string }[]> = {
  videoteca: [
    { valor: 'nombre', nombre: 'Título' },
    { valor: 'anio', nombre: 'Año' },
    { valor: 'anadido', nombre: 'Últimas añadidas' },
  ],
  discoteca: [
    { valor: 'nombre', nombre: 'Artista' },
    { valor: 'titulo', nombre: 'Álbum' },
    { valor: 'anio', nombre: 'Año' },
    { valor: 'anadido', nombre: 'Últimos añadidos' },
  ],
};

function comparar(orden: Orden) {
  const nombre = (a: Item, b: Item) => claveOrden(a.titulo).localeCompare(claveOrden(b.titulo), 'es', { numeric: true });
  const artista = (a: Item, b: Item) =>
    claveOrden(a.artista).localeCompare(claveOrden(b.artista), 'es') || (a.anio ?? 9999) - (b.anio ?? 9999) || nombre(a, b);
  return (a: Item, b: Item) => {
    switch (orden) {
      case 'nombre':
        return a.seccion === 'discoteca' ? artista(a, b) : nombre(a, b);
      case 'titulo':
        return nombre(a, b);
      case 'anio':
        return (a.anio ?? 9999) - (b.anio ?? 9999) || nombre(a, b);
      case 'anadido':
        return b.anadido.localeCompare(a.anadido) || nombre(a, b);
    }
  };
}

/** Separadores de la estantería: por letra, por década o ninguno. */
function grupoDe(item: Item, orden: Orden): string {
  if (orden === 'anadido') return '';
  if (orden === 'anio') return item.anio ? `${Math.floor(item.anio / 10) * 10}s` : 'Sin año';
  const clave = claveOrden(orden === 'nombre' && item.seccion === 'discoteca' ? item.artista : item.titulo);
  const letra = clave.charAt(0).toUpperCase();
  return /[A-ZÑ]/.test(letra) ? letra : '#';
}

export default function App() {
  const [coleccion, setColeccion] = useState<Coleccion | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [prefs, setPrefs] = useState(leerPreferencias);
  const [busqueda, setBusqueda] = useState('');
  const [formatos, setFormatos] = useState<string[]>([]);
  const [revision, setRevision] = useState<Revision>('todas');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ item: Item; nuevo: boolean } | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  const buscador = useRef<HTMLInputElement>(null);

  const { seccion, vista } = prefs;
  const orden = prefs.orden[seccion];

  useEffect(() => {
    cargar().then(setColeccion, (e) => setErrorCarga(String(e)));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS, JSON.stringify(prefs));
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
    document.documentElement.dataset.seccion = seccion;
  }, [prefs, seccion]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.error ? 6000 : 1800);
    return () => clearTimeout(t);
  }, [aviso]);

  // «/» para buscar, como en tantas webs.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        buscador.current?.focus();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const cambiarSeccion = (s: Seccion) => {
    setPrefs((p) => ({ ...p, seccion: s }));
    setFormatos([]);
    setBusqueda('');
  };

  const items = coleccion?.items ?? [];
  const deSeccion = useMemo(() => items.filter((i) => i.seccion === seccion), [items, seccion]);

  const conteoFormatos = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of deSeccion) c.set(i.formato, (c.get(i.formato) ?? 0) + 1);
    // Primero los formatos conocidos en su orden, luego cualquier otro.
    const orden = [...FORMATOS[seccion], ...[...c.keys()].filter((f) => !FORMATOS[seccion].includes(f))];
    return orden.filter((f) => c.has(f)).map((f) => [f, c.get(f)!] as const);
  }, [deSeccion, seccion]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return deSeccion
      .filter((i) => !formatos.length || formatos.includes(i.formato))
      .filter((i) => revision === 'todas' || (revision === 'sin-portada' ? !i.portada : i.portadaAuto))
      .filter(
        (i) => !q || normalizar([i.titulo, i.artista, i.director, i.edicion, i.notas, i.anio].filter(Boolean).join(' ')).includes(q),
      )
      .sort(comparar(orden));
  }, [deSeccion, formatos, revision, busqueda, orden]);

  const grupos = useMemo(() => {
    const g: { nombre: string; items: Item[] }[] = [];
    for (const i of visibles) {
      const nombre = grupoDe(i, orden);
      if (g.at(-1)?.nombre !== nombre) g.push({ nombre, items: [] });
      g.at(-1)!.items.push(i);
    }
    return g;
  }, [visibles, orden]);

  const artistas = useMemo(
    () => [...new Set(items.map((i) => i.artista).filter((a): a is string => !!a))].sort((a, b) => a.localeCompare(b, 'es')),
    [items],
  );

  const actualizar = useCallback(
    async (cambio: (items: Item[]) => Item[], textoAviso: string) => {
      if (!coleccion) return;
      const anterior = coleccion;
      const nueva: Coleccion = { ...coleccion, actualizado: new Date().toISOString(), items: cambio(coleccion.items) };
      setColeccion(nueva);
      try {
        await guardar(nueva);
        setAviso({ texto: textoAviso });
      } catch (e) {
        setColeccion(anterior);
        setAviso({ texto: `No se pudo guardar: ${e instanceof Error ? e.message : e}`, error: true });
      }
    },
    [coleccion],
  );

  const itemAbierto = abierto ? items.find((i) => i.id === abierto) : undefined;

  const mover = useCallback(
    (paso: 1 | -1) => {
      const n = visibles.findIndex((i) => i.id === abierto);
      if (n < 0 || !visibles.length) return;
      setAbierto(visibles[(n + paso + visibles.length) % visibles.length].id);
    },
    [visibles, abierto],
  );

  const cerrarFicha = useCallback(() => setAbierto(null), []);
  const cancelarEdicion = useCallback(() => setEditando(null), []);

  function guardarItem(item: Item) {
    const nuevo = editando?.nuevo;
    actualizar(
      (lista) => (nuevo ? [...lista, item] : lista.map((i) => (i.id === item.id ? item : i))),
      nuevo ? 'Añadido' : 'Guardado',
    );
    setEditando(null);
    if (nuevo && item.seccion !== seccion) cambiarSeccion(item.seccion);
    setAbierto(item.id);
  }

  function borrar(item: Item) {
    if (!confirm(`¿Borrar «${item.titulo}»${item.artista ? ` de ${item.artista}` : ''}?`)) return;
    setAbierto(null);
    actualizar((lista) => lista.filter((i) => i.id !== item.id), 'Borrado');
  }

  function anadir() {
    setEditando({
      nuevo: true,
      item: { id: nuevoId(), seccion, titulo: '', formato: FORMATOS[seccion][0], anadido: new Date().toISOString().slice(0, 10) },
    });
  }

  const porRevisar = deSeccion.filter((i) => i.portadaAuto).length;
  const sinPortada = deSeccion.filter((i) => !i.portada).length;
  const textos = SECCIONES[seccion];

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-24 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-8 sm:pt-10">
        <div>
          <h1 className="font-display text-5xl leading-none tracking-wider sm:text-6xl">
            Media<span className="acento">teca</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--suave)]">
            {coleccion
              ? `${items.filter((i) => i.seccion === 'videoteca').length} películas y ${items.filter((i) => i.seccion === 'discoteca').length} discos`
              : 'Cargando…'}
          </p>
        </div>
        <nav className="flex rounded-2xl border border-[var(--borde)] bg-[var(--panel)] p-1">
          {(Object.keys(SECCIONES) as Seccion[]).map((s) => {
            const Icono = s === 'videoteca' ? Film : Disc3;
            return (
              <button
                key={s}
                onClick={() => cambiarSeccion(s)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  seccion === s ? 'bg-[var(--acento)] text-[#141016]' : 'text-[var(--suave)] hover:text-[var(--texto)]'
                }`}
              >
                <Icono size={17} /> {SECCIONES[s].nombre}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="sticky top-0 z-20 -mx-4 mb-6 flex flex-col gap-3 border-b border-[var(--borde)] bg-[var(--fondo)]/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-56">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--suave)]" />
            <input
              ref={buscador}
              className="campo pl-9 pr-9"
              placeholder={seccion === 'discoteca' ? 'Buscar artista, álbum, edición…' : 'Buscar película, edición, director…'}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--suave)] hover:text-white"
                onClick={() => setBusqueda('')}
                aria-label="Borrar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </label>
          <select
            className="campo w-auto"
            value={orden}
            onChange={(e) => setPrefs((p) => ({ ...p, orden: { ...p.orden, [seccion]: e.target.value as Orden } }))}
            aria-label="Ordenar por"
          >
            {ORDENES[seccion].map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.nombre}
              </option>
            ))}
          </select>
          <div className="flex rounded-[10px] border border-[var(--borde)] p-0.5">
            {(
              [
                ['estanteria', LayoutGrid, 'Estantería'],
                ['lista', List, 'Lista'],
              ] as const
            ).map(([v, Icono, nombre]) => (
              <button
                key={v}
                className={`rounded-lg p-2 ${vista === v ? 'bg-[var(--panel-2)] text-[var(--texto)]' : 'text-[var(--suave)]'}`}
                onClick={() => setPrefs((p) => ({ ...p, vista: v }))}
                aria-label={nombre}
                title={nombre}
              >
                <Icono size={17} />
              </button>
            ))}
          </div>
          {EDITABLE && (
            <button className="boton boton-acento py-[9px]" onClick={anadir} aria-label="Añadir" title="Añadir">
              <Plus size={16} /> <span className="hidden sm:inline">Añadir</span>
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <button className="chip" aria-pressed={!formatos.length} onClick={() => setFormatos([])}>
            Todo · {deSeccion.length}
          </button>
          {conteoFormatos.map(([f, n]) => (
            <button
              key={f}
              className="chip"
              aria-pressed={formatos.includes(f)}
              onClick={() => setFormatos((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))}
            >
              {f} · {n}
            </button>
          ))}
          {EDITABLE && (porRevisar > 0 || sinPortada > 0) && (
            <>
              <span className="mx-1 w-px shrink-0 bg-[var(--borde)]" />
              {porRevisar > 0 && (
                <button
                  className="chip"
                  aria-pressed={revision === 'por-revisar'}
                  onClick={() => setRevision((r) => (r === 'por-revisar' ? 'todas' : 'por-revisar'))}
                >
                  Portadas por revisar · {porRevisar}
                </button>
              )}
              {sinPortada > 0 && (
                <button
                  className="chip"
                  aria-pressed={revision === 'sin-portada'}
                  onClick={() => setRevision((r) => (r === 'sin-portada' ? 'todas' : 'sin-portada'))}
                >
                  Sin portada · {sinPortada}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {errorCarga && <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{errorCarga}</p>}

      {coleccion && visibles.length === 0 && (
        <p className="py-20 text-center text-[var(--suave)]">
          {deSeccion.length ? 'Nada con esos filtros.' : `Aún no hay ${textos.plural}.`}
        </p>
      )}

      {vista === 'estanteria' ? (
        <div className="flex flex-col gap-10">
          {grupos.map((g) => (
            <section key={g.nombre || 'todo'}>
              {g.nombre && (
                <h2 className="mb-4 flex items-center gap-3 font-display text-3xl tracking-wider text-[var(--suave)]">
                  <span className="acento">{g.nombre}</span>
                  <span className="h-px flex-1 bg-[var(--borde)]" />
                  <span className="font-sans text-xs tracking-normal">{g.items.length}</span>
                </h2>
              )}
              <div className="rejilla">
                {g.items.map((i) => (
                  <button key={i.id} className="tarjeta" onClick={() => setAbierto(i.id)}>
                    <Portada item={i} />
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-sm font-semibold leading-tight">{i.titulo}</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--suave)]">
                        {[i.artista, i.formato, i.anio].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--borde)]">
          {visibles.map((i) => (
            <button
              key={i.id}
              onClick={() => setAbierto(i.id)}
              className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b border-[var(--borde)] px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-[var(--panel)] sm:grid-cols-[2.5rem_2fr_1.6fr_6rem_3.5rem]"
            >
              <span className="h-10 w-10 overflow-hidden rounded bg-[var(--panel-2)]">
                {i.portada && <img src={i.portada} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{i.titulo}</span>
                <span className="block truncate text-xs text-[var(--suave)]">{i.artista ?? i.director}</span>
              </span>
              <span className="hidden truncate text-[var(--suave)] sm:block">{i.edicion}</span>
              <span className="text-xs font-semibold text-[var(--acento)]">{i.formato}</span>
              <span className="hidden text-right text-[var(--suave)] sm:block">{i.anio}</span>
            </button>
          ))}
        </div>
      )}

      {coleccion?.actualizado && (
        <p className="mt-16 text-center text-xs text-[var(--suave)]">
          Actualizado el {new Date(coleccion.actualizado).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      {itemAbierto && !editando && (
        <Ficha
          item={itemAbierto}
          onCerrar={cerrarFicha}
          onMover={mover}
          onEditar={() => setEditando({ item: itemAbierto, nuevo: false })}
          onBorrar={() => borrar(itemAbierto)}
          onConfirmarPortada={() =>
            actualizar((l) => l.map((i) => (i.id === itemAbierto.id ? { ...i, portadaAuto: undefined } : i)), 'Portada confirmada')
          }
        />
      )}

      {editando && (
        <Formulario item={editando.item} nuevo={editando.nuevo} artistas={artistas} onGuardar={guardarItem} onCancelar={cancelarEdicion} />
      )}

      {aviso && (
        <div
          className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-xl ${
            aviso.error ? 'bg-red-600 text-white' : 'bg-[var(--texto)] text-[var(--fondo)]'
          }`}
        >
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
