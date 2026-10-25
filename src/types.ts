export type Seccion = 'videoteca' | 'discoteca';

export interface Item {
  id: string;
  seccion: Seccion;
  /** Película o serie en la videoteca; álbum en la discoteca. */
  titulo: string;
  /** Solo discoteca. */
  artista?: string;
  /** Solo videoteca. */
  director?: string;
  /** Texto libre: «Ed Especial 2 DVD», «2 x CD, Compilation, Digipak»… */
  edicion?: string;
  formato: string;
  anio?: number;
  /** URL de la imagen de portada. */
  portada?: string;
  /** La puso el buscador automático y nadie la ha revisado aún. */
  portadaAuto?: boolean;
  notas?: string;
  /** Fecha ISO (AAAA-MM-DD) en que se añadió. */
  anadido: string;
}

export interface Coleccion {
  version: 1;
  /** Fecha ISO del último guardado. */
  actualizado?: string;
  items: Item[];
}

export const FORMATOS: Record<Seccion, string[]> = {
  videoteca: ['DVD', 'Blu-ray', '4K UHD', 'VHS'],
  discoteca: ['CD', 'Vinilo', 'Cassette', 'DVD', 'VHS'],
};

export const SECCIONES: Record<Seccion, { nombre: string; singular: string; plural: string }> = {
  videoteca: { nombre: 'Videoteca', singular: 'película', plural: 'películas' },
  discoteca: { nombre: 'Discoteca', singular: 'disco', plural: 'discos' },
};
