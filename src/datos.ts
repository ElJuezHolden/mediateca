import { ARCHIVO, FIRMA, RAMA, REPO, leerToken } from './sesion';
import type { Coleccion, Item } from './types';

// Dónde vive la colección:
//  - En local (npm run dev): public/coleccion.json, que Vite lee y escribe.
//  - En la web publicada, con acceso para editar: el mismo archivo, pero
//    leído y guardado en el repo de GitHub, así se ve al momento lo último y
//    cada cambio es un commit (que vuelve a publicar la web en un par de minutos).
//  - En la web publicada, sin acceso: la copia publicada, de solo lectura.

const API = `https://api.github.com/repos/${REPO}/contents/${ARCHIVO}`;
/** El sha del archivo en GitHub, que pide la API para guardar encima. */
let shaActual = '';

function cabecerasGithub(token: string, accept = 'application/vnd.github+json') {
  return { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' };
}

export async function cargar(): Promise<Coleccion> {
  const token = import.meta.env.DEV ? '' : leerToken('github');
  if (token) {
    const [meta, raw] = await Promise.all([
      fetch(`${API}?ref=${RAMA}`, { headers: cabecerasGithub(token), cache: 'no-store' }),
      fetch(`${API}?ref=${RAMA}`, { headers: cabecerasGithub(token, 'application/vnd.github.raw+json'), cache: 'no-store' }),
    ]);
    if (meta.ok && raw.ok) {
      shaActual = (await meta.json()).sha;
      return raw.json();
    }
    // Con el token caducado o sin permiso se sigue en solo lectura.
    console.warn(`GitHub: HTTP ${meta.status}; se carga la copia publicada.`);
  }
  const r = await fetch(`${import.meta.env.BASE_URL}coleccion.json`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`No se pudo cargar la colección (HTTP ${r.status})`);
  return r.json();
}

/** Base64 de un texto con tildes (btoa solo acepta latin-1). */
function base64(texto: string) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

// Los guardados van de uno en uno: cada uno necesita el sha que deja el anterior.
let cola: Promise<unknown> = Promise.resolve();

export function guardar(coleccion: Coleccion, mensaje = 'Mediateca: cambios desde la web'): Promise<void> {
  const tarea = cola.then(() => (import.meta.env.DEV ? guardarLocal(coleccion) : guardarGithub(coleccion, mensaje)));
  cola = tarea.catch(() => {});
  return tarea;
}

async function guardarLocal(coleccion: Coleccion) {
  const r = await fetch('/api/coleccion', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(coleccion),
  });
  if (!r.ok) throw new Error(await r.text());
}

async function guardarGithub(coleccion: Coleccion, mensaje: string) {
  const token = leerToken('github');
  if (!token) throw new Error('No tienes acceso para editar en este navegador.');
  const r = await fetch(API, {
    method: 'PUT',
    headers: { ...cabecerasGithub(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: mensaje,
      content: base64(JSON.stringify(coleccion, null, 1) + '\n'),
      sha: shaActual,
      branch: RAMA,
      author: FIRMA,
      committer: FIRMA,
    }),
  });
  if (r.status === 409 || r.status === 422) {
    throw new Error('La colección ha cambiado desde otro sitio (otro dispositivo o en local). Recarga la página y vuelve a hacer el cambio.');
  }
  if (!r.ok) throw new Error(`GitHub: HTTP ${r.status}`);
  shaActual = (await r.json()).content.sha;
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
