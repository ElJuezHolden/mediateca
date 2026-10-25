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
  /** Id de la edición en Discogs (solo discoteca). */
  discogs?: number;
  /** Datos de la edición, normalmente traídos de Discogs. */
  sello?: string;
  catalogo?: string;
  pais?: string;
  generos?: string[];
  pistas?: Pista[];
  notas?: string;
  /** Fecha ISO (AAAA-MM-DD) en que se añadió. */
  anadido: string;
}

export interface Pista {
  /** «1», «A2», «2-05»… tal cual viene en el disco. */
  pos: string;
  titulo: string;
  duracion?: string;
  /** Solo si no es el artista del disco (recopilatorios). */
  artista?: string;
  /** Cabecera de una parte («CD 1», «Cara A»…), sin duración. */
  cabecera?: boolean;
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
