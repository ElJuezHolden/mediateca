// Busca portada para todo lo que no la tenga y apunta solo las que casan sin
// duda (mismo título y, en los discos, mismo artista). Quedan marcadas como
// «por revisar» en la web hasta que las confirmes.
//
//   npm run portadas                 toda la colección
//   npm run portadas -- discoteca    solo una sección
//
// Guarda cada pocos títulos en public/coleccion.json, así que se puede cortar
// y volver a lanzar. No lo ejecutes con la web abierta editando.
import fs from 'node:fs';
import path from 'node:path';
import { buscarDisco, buscarPelicula, candidataSegura, usarCabeceras } from '../src/portadas.ts';
import type { Coleccion, Seccion } from '../src/types.ts';

const ARCHIVO = path.resolve(import.meta.dirname, '../public/coleccion.json');
const coleccion: Coleccion = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
// Wikimedia limita mucho las peticiones sin un User-Agent que diga quién es.
usarCabeceras({ 'User-Agent': 'Mediateca/1.0 (https://github.com/ElJuezHolden/mediateca; coleccion personal)' });

const solo = process.argv[2] as Seccion | undefined;
const pendientes = coleccion.items.filter((i) => !i.portada && (!solo || i.seccion === solo));
let puestas = 0;
const sinPortada: string[] = [];

function guardar() {
  coleccion.actualizado = new Date().toISOString();
  const temporal = `${ARCHIVO}.tmp`;
  fs.writeFileSync(temporal, JSON.stringify(coleccion, null, 1) + '\n', 'utf8');
  fs.renameSync(temporal, ARCHIVO);
}

for (const [n, item] of pendientes.entries()) {
  const nombre = item.artista ? `${item.artista} — ${item.titulo}` : item.titulo;
  const prefijo = `[${n + 1}/${pendientes.length}]`;
  try {
    const candidatas =
      item.seccion === 'videoteca' ? await buscarPelicula(item.titulo) : await buscarDisco(item.artista, item.titulo);
    const c = candidataSegura(item, candidatas);
    if (c) {
      item.portada = c.url;
      item.portadaAuto = true;
      item.anio ??= c.anio;
      if (item.seccion === 'videoteca' && c.director) item.director ??= c.director;
      puestas++;
      console.log(`${prefijo} ✓ ${nombre}`);
    } else {
      sinPortada.push(nombre);
      console.log(`${prefijo} · ${nombre} (${candidatas.length} candidatas, ninguna segura)`);
    }
  } catch (error) {
    sinPortada.push(nombre);
    console.log(`${prefijo} ✗ ${nombre}: ${error}`);
  }
  if (n % 5 === 4) guardar();
  // Con calma: iTunes corta a unas 20 peticiones por minuto.
  await new Promise((r) => setTimeout(r, item.seccion === 'discoteca' ? 3200 : 1000));
}

guardar();
console.log(`\n${puestas} portadas puestas de ${pendientes.length}. Sin portada segura: ${sinPortada.length}.`);
