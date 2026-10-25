import type { Coleccion, Item } from './types';

/**
 * Solo se edita en local (npm run dev), donde Vite guarda en
 * public/coleccion.json. La web publicada es de consulta.
 */
export const EDITABLE = import.meta.env.DEV;

export async function cargar(): Promise<Coleccion> {
  const r = await fetch(`${import.meta.env.BASE_URL}coleccion.json`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`No se pudo cargar la colección (HTTP ${r.status})`);
  return r.json();
}

export async function guardar(coleccion: Coleccion): Promise<void> {
  const r = await fetch('/api/coleccion', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(coleccion),
  });
  if (!r.ok) throw new Error(await r.text());
}

export function nuevoId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

const ARTICULOS = /^(el|la|los|las|the|un|una)\s+/i;

/** Clave para ordenar por nombre sin contar el artículo: «El Rey León» va en la R. */
export function claveOrden(texto: string | undefined): string {
  return (texto ?? '')
    .trim()
    .replace(/^["'¿¡]+/, '')
    .replace(ARTICULOS, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function nombreCompleto(item: Item) {
  return item.artista ? `${item.artista} — ${item.titulo}` : item.titulo;
}

/** Color estable por texto, para las portadas que aún no tienen imagen. */
export function tono(texto: string) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}
