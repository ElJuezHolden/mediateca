import { useEffect } from 'react';
import { Check, ChevronLeft, ChevronRight, ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { EDITABLE } from '../datos';
import type { Item } from '../types';
import { Portada } from './Portada';

interface Props {
  item: Item;
  onCerrar: () => void;
  onMover: (paso: 1 | -1) => void;
  onEditar: () => void;
  onBorrar: () => void;
  onConfirmarPortada: () => void;
}

function enlaces(item: Item) {
  const q = encodeURIComponent(item.artista ? `${item.artista} ${item.titulo}` : item.titulo);
  return item.seccion === 'discoteca'
    ? [
        {
          nombre: item.discogs ? 'Su edición en Discogs' : 'Discogs',
          url: item.discogs ? `https://www.discogs.com/release/${item.discogs}` : `https://www.discogs.com/search/?q=${q}&type=all`,
        },
        { nombre: 'YouTube', url: `https://www.youtube.com/results?search_query=${q}` },
      ]
    : [
        { nombre: 'FilmAffinity', url: `https://www.filmaffinity.com/es/search.php?stext=${q}` },
        { nombre: 'Wikipedia', url: `https://es.wikipedia.org/w/index.php?search=${q}` },
      ];
}

export function Ficha({ item, onCerrar, onMover, onEditar, onBorrar, onConfirmarPortada }: Props) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      else if (e.key === 'ArrowRight') onMover(1);
      else if (e.key === 'ArrowLeft') onMover(-1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar, onMover]);

  const musica = item.seccion === 'discoteca';
  const datos: [string, string | number | undefined][] = [
    ['Formato', item.formato],
    ['Edición', item.edicion],
    ['Año', item.anio],
    ['Dirección', musica ? undefined : item.director],
    ['Sello', [item.sello, item.catalogo].filter(Boolean).join(' · ')],
    ['País', item.pais],
  ];
  const canciones = item.pistas?.filter((p) => !p.cabecera) ?? [];
  const minutos = Math.round(canciones.reduce((total, p) => total + segundos(p.duracion), 0) / 60);

  return (
    <div className="velo" onClick={onCerrar}>
      <button
        className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full p-2 text-[var(--suave)] hover:text-white sm:block"
        onClick={(e) => (e.stopPropagation(), onMover(-1))}
        aria-label="Anterior"
      >
        <ChevronLeft size={32} />
      </button>
      <button
        className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full p-2 text-[var(--suave)] hover:text-white sm:block"
        onClick={(e) => (e.stopPropagation(), onMover(1))}
        aria-label="Siguiente"
      >
        <ChevronRight size={32} />
      </button>

      <div
        key={item.id}
        className="ventana relative grid max-h-full w-full max-w-3xl gap-6 overflow-y-auto overflow-x-hidden rounded-2xl border border-[var(--borde)] bg-[var(--panel)] p-5 sm:grid-cols-[minmax(0,17rem)_1fr] sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-[var(--suave)] hover:text-white" onClick={onCerrar} aria-label="Cerrar">
          <X size={20} />
        </button>

        <div className={`mx-auto sm:w-full ${musica ? 'w-64 pr-[30%]' : 'w-48'}`}>
          <Portada item={item} grande />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div>
            {musica && item.artista && <p className="acento text-sm font-semibold uppercase tracking-wider">{item.artista}</p>}
            <h2 className="font-display text-4xl leading-none tracking-wide sm:text-5xl">{item.titulo}</h2>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
            {datos
              .filter(([, v]) => v !== undefined && v !== '')
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-[var(--suave)]">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>

          {item.generos?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {item.generos.map((g) => (
                <span key={g} className="rounded-full bg-[var(--fondo)] px-2.5 py-0.5 text-xs text-[var(--suave)]">
                  {g}
                </span>
              ))}
            </div>
          ) : null}

          {item.notas && <p className="whitespace-pre-line rounded-xl bg-[var(--fondo)] p-3 text-sm text-[var(--suave)]">{item.notas}</p>}

          {EDITABLE && item.portadaAuto && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--borde)] p-3 text-sm">
              <span className="text-[var(--suave)]">Portada puesta automáticamente. ¿Es la tuya?</span>
              <button className="boton py-1" onClick={onConfirmarPortada}>
                <Check size={14} /> Sí
              </button>
              <button className="boton py-1" onClick={onEditar}>
                Cambiarla
              </button>
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            {enlaces(item).map((e) => (
              <a key={e.nombre} className="boton" href={e.url} target="_blank" rel="noreferrer">
                {e.nombre} <ExternalLink size={13} />
              </a>
            ))}
            {EDITABLE && (
              <>
                <span className="flex-1" />
                <button className="boton" onClick={onBorrar} aria-label="Borrar">
                  <Trash2 size={15} />
                </button>
                <button className="boton boton-acento" onClick={onEditar}>
                  <Pencil size={15} /> Editar
                </button>
              </>
            )}
          </div>
        </div>

        {canciones.length > 0 && (
          <section className="border-t border-[var(--borde)] pt-5 sm:col-span-2">
            <h3 className="mb-3 flex items-baseline gap-3 font-display text-2xl tracking-wide">
              Canciones
              <span className="font-sans text-xs tracking-normal text-[var(--suave)]">
                {canciones.length}
                {minutos > 0 && ` · ${minutos} min`}
              </span>
            </h3>
            <ol className="gap-8 text-sm sm:columns-2">
              {item.pistas!.map((p, n) =>
                p.cabecera ? (
                  <li key={n} className="acento break-after-avoid pb-1 pt-3 text-xs font-semibold uppercase tracking-wider first:pt-0">
                    {p.titulo}
                  </li>
                ) : (
                  <li key={n} className="flex break-inside-avoid gap-3 py-1">
                    <span className="w-7 shrink-0 text-right tabular-nums text-[var(--suave)]">{p.pos}</span>
                    <span className="min-w-0 flex-1">
                      {p.titulo}
                      {p.artista && <span className="block text-xs text-[var(--suave)]">{p.artista}</span>}
                    </span>
                    {p.duracion && <span className="tabular-nums text-[var(--suave)]">{p.duracion}</span>}
                  </li>
                ),
              )}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

/** «4:26» o «1:02:15» en segundos. */
function segundos(duracion?: string) {
  return (duracion ?? '').split(':').reduce((total, parte) => total * 60 + (Number(parte) || 0), 0);
}
