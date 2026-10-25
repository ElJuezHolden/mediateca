// Entre las fotos de una edición de Discogs, encuentra la del disco (el CD o el
// vinilo): un círculo grande sobre un fondo liso. Discogs no dice qué es cada
// foto, y sus imágenes no se pueden analizar desde el navegador, así que lo
// hace el servidor local (vite.config.ts) y el script de Discogs.
import type { FotoDisco } from '../src/types.ts';

const LADO = 96;

/** Cómo de seguro es que la foto sea un disco; null si no lo parece. */
async function analizar(datos: ArrayBuffer): Promise<Omit<FotoDisco, 'url'> | null> {
  // Se carga aquí y no arriba para que publicar la web (vite build) no lo necesite.
  const { default: sharp } = await import('sharp');
  const imagen = sharp(Buffer.from(datos));
  const { width = 0, height = 0 } = await imagen.metadata();
  if (!width || !height || width / height < 0.8 || width / height > 1.25) return null;
  const { data } = await imagen.resize(LADO, LADO, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => {
    const i = (y * LADO + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // El fondo: el color mediano de las esquinas (lo que queda fuera del círculo
  // que cabe en la foto), que tiene que ser casi todo igual. Así vale también
  // cuando el disco llena la foto y toca los bordes.
  const esquinas: number[][] = [];
  for (let y = 0; y < LADO; y++)
    for (let x = 0; x < LADO; x++) if (Math.hypot(x + 0.5 - LADO / 2, y + 0.5 - LADO / 2) > LADO * 0.52) esquinas.push(px(x, y));
  const mediana = [0, 1, 2].map((c) => esquinas.map((p) => p[c]).sort((a, b) => a - b)[esquinas.length >> 1]);
  const distancia = (p: number[]) => Math.hypot(p[0] - mediana[0], p[1] - mediana[1], p[2] - mediana[2]);
  if (esquinas.filter((p) => distancia(p) < 40).length / esquinas.length < 0.8) return null;

  // Lo que no es fondo, y su caja.
  const disco: boolean[] = [];
  let [x0, y0, x1, y1] = [LADO, LADO, -1, -1];
  for (let y = 0; y < LADO; y++)
    for (let x = 0; x < LADO; x++) {
      const es = distancia(px(x, y)) >= 40;
      disco.push(es);
      if (es) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  const ancho = x1 - x0 + 1;
  const alto = y1 - y0 + 1;
  if (ancho < LADO * 0.6 || alto < LADO * 0.6 || ancho / alto < 0.9 || ancho / alto > 1.11) return null;

  // Redondo: dentro del círculo inscrito casi todo es disco (salvo el agujero
  // y el anillo transparente del centro) y fuera, en las esquinas, casi nada.
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = (ancho + alto) / 4;
  let dentro = 0;
  let dentroDisco = 0;
  let fuera = 0;
  let fueraDisco = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      const es = disco[y * LADO + x];
      if (d < 0.95 && d > 0.3) (dentro++, es && dentroDisco++);
      else if (d > 1.08) (fuera++, es && fueraDisco++);
    }
  if (dentroDisco / dentro < 0.75 || fueraDisco / Math.max(fuera, 1) > 0.15) return null;

  return { x: (cx + 0.5) / LADO, y: (cy + 0.5) / LADO, r: r / LADO, proporcion: height / width };
}

/**
 * La foto del disco entre las de una edición, o null. Se salta la primera
 * (la portada) y se queda con la que mejor parece un disco.
 */
export async function buscarFotoDisco(urls: string[]): Promise<FotoDisco | null> {
  for (const url of urls.slice(1)) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mediateca/1.0 +https://github.com/ElJuezHolden/mediateca' } });
      if (!r.ok) continue;
      const encontrada = await analizar(await r.arrayBuffer());
      if (encontrada) return { url, ...encontrada };
    } catch {
      /* esa foto no se pudo leer: la siguiente */
    }
  }
  return null;
}
