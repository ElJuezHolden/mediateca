// Completa los discos que ya están vinculados a una edición de Discogs con
// todos sus datos: sello, nº de catálogo, país, géneros y canciones. No toca
// cómo los tenías apuntados (título, artista, edición, formato) ni si su
// portada está aún por revisar.
//
//   npm run discogs              los vinculados a los que les faltan datos
//   npm run discogs -- --todos   vuelve a traerlos todos
//
// Necesita DISCOGS_TOKEN en .env.local. No lo ejecutes con la web abierta editando.
import fs from 'node:fs';
import path from 'node:path';
import { edicionDiscogs, usarTokenDiscogs, vincularDiscogs } from '../src/portadas.ts';
import type { Coleccion } from '../src/types.ts';

const ARCHIVO = path.resolve(import.meta.dirname, '../public/coleccion.json');
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../.env.local'));
} catch {
  /* sin .env.local */
}
const token = process.env.DISCOGS_TOKEN?.trim();
if (!token) {
  console.error('Falta DISCOGS_TOKEN en .env.local.');
  process.exit(1);
}
usarTokenDiscogs(token);

const coleccion: Coleccion = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
const todos = process.argv.includes('--todos');
const pendientes = coleccion.items.filter((i) => i.discogs && (todos || !i.pistas));

function guardar() {
  coleccion.actualizado = new Date().toISOString();
  const temporal = `${ARCHIVO}.tmp`;
  fs.writeFileSync(temporal, JSON.stringify(coleccion, null, 1) + '\n', 'utf8');
  fs.renameSync(temporal, ARCHIVO);
}

let completados = 0;
for (const [n, item] of pendientes.entries()) {
  const prefijo = `[${n + 1}/${pendientes.length}] ${item.artista} — ${item.titulo}`;
  try {
    const e = await edicionDiscogs(String(item.discogs));
    const nuevo = vincularDiscogs(item, e);
    // La portada sigue siendo la que había y, si estaba por revisar, lo sigue estando.
    Object.assign(item, nuevo, { portada: item.portada, portadaAuto: item.portadaAuto });
    if (!item.portadaAuto) delete item.portadaAuto;
    for (const k of Object.keys(item) as (keyof typeof item)[]) if (item[k] === undefined) delete item[k];
    completados++;
    console.log(`${prefijo}: ${[e.sello, e.catalogo, e.pais, `${e.pistas?.length ?? 0} pistas`].filter(Boolean).join(' · ')}`);
  } catch (error) {
    console.log(`${prefijo}: ✗ ${error}`);
  }
  if (n % 5 === 4) guardar();
  // Discogs deja 60 peticiones por minuto con token.
  await new Promise((r) => setTimeout(r, 1100));
}

guardar();
console.log(`\n${completados} discos completados de ${pendientes.length}.`);
