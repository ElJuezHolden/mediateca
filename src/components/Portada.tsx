import { useState } from 'react';
import { tono } from '../datos';
import type { Item } from '../types';

/** Clase CSS de cada formato: cada uno tiene la forma y la caja del real. */
export function claseFormato(formato: string) {
  const f = formato.toLowerCase();
  if (f.includes('4k')) return 'uhd';
  if (f.includes('blu')) return 'bluray';
  if (f.includes('vhs')) return 'vhs';
  if (f.includes('dvd')) return 'dvd';
  if (f.includes('vinil') || f === 'lp') return 'vinilo';
  if (f.includes('cass')) return 'cassette';
  if (f.includes('cd')) return 'cd';
  return 'otro';
}

const BANDA: Record<string, string> = { dvd: 'DVD', bluray: 'Blu-ray Disc', uhd: '4K ULTRA HD' };

interface Props {
  item: Pick<Item, 'titulo' | 'artista' | 'formato' | 'portada' | 'fotoDisco'>;
  /** La ficha grande: sin animación al pasar el ratón y con el disco fuera. */
  grande?: boolean;
}

export function Portada({ item, grande }: Props) {
  const [fallo, setFallo] = useState<string | null>(null);
  const clase = claseFormato(item.formato);
  const conImagen = item.portada && fallo !== item.portada;
  const lleva = clase === 'cd' || clase === 'vinilo';

  return (
    <div className={`objeto objeto-${clase}${grande ? ' grande' : ''}`}>
      {lleva && (
        <div className={`disco disco-${clase}${item.fotoDisco ? ' con-foto' : ''}`} aria-hidden>
          {item.fotoDisco && <FotoDelDisco foto={item.fotoDisco} />}
          {clase === 'vinilo' && !item.fotoDisco && (
            <span className="galleta" style={conImagen ? { backgroundImage: `url("${item.portada}")` } : undefined} />
          )}
        </div>
      )}
      <div className="funda">
        {conImagen ? (
          <img
            src={item.portada}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFallo(item.portada!)}
          />
        ) : (
          <div className="sin-portada" style={{ '--h': tono(item.artista ?? item.titulo) } as React.CSSProperties}>
            {item.artista && <span className="sp-artista">{item.artista}</span>}
            <span className="sp-titulo">{item.titulo}</span>
          </div>
        )}
        {BANDA[clase] && <span className="banda">{BANDA[clase]}</span>}
        <span className="brillo" aria-hidden />
      </div>
    </div>
  );
}

/** La foto real del disco, recortada en círculo y centrada en él. */
function FotoDelDisco({ foto }: { foto: NonNullable<Item['fotoDisco']> }) {
  // El ancho de la foto para que el disco ocupe todo el círculo, y su posición
  // para que el centro del disco caiga en el centro (en % del círculo).
  const ancho = 100 / (2 * foto.r);
  return (
    <img
      src={foto.url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className="foto-disco"
      style={{ width: `${ancho}%`, left: `${50 - foto.x * ancho}%`, top: `${50 - foto.y * foto.proporcion * ancho}%` }}
    />
  );
}
