import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { buscarFotoDisco } from './scripts/foto-disco.ts';

const COLECCION = path.resolve(import.meta.dirname, 'public/coleccion.json');

// Solo en local (npm run dev): la web guarda los cambios directamente en
// public/coleccion.json. La versión publicada no tiene este endpoint y es de
// solo lectura.
function guardarColeccion(): Plugin {
  return {
    name: 'guardar-coleccion',
    configureServer(server) {
      server.middlewares.use('/api/coleccion', (req, res) => {
        if (req.method !== 'PUT') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let cuerpo = '';
        req.setEncoding('utf8');
        req.on('data', (trozo) => (cuerpo += trozo));
        req.on('end', () => {
          try {
            const datos = JSON.parse(cuerpo);
            if (!Array.isArray(datos?.items)) throw new Error('Formato no válido');
            // Se escribe en un temporal y se renombra, para no dejar nunca el
            // archivo a medias.
            const temporal = `${COLECCION}.tmp`;
            fs.writeFileSync(temporal, JSON.stringify(datos, null, 1) + '\n', 'utf8');
            fs.renameSync(temporal, COLECCION);
            res.end('ok');
          } catch (error) {
            res.statusCode = 400;
            res.end(String(error));
          }
        });
      });
    },
  };
}

// Solo en local: la web pide a Discogs a través de aquí, que añade el token de
// .env.local. Así el token nunca llega al navegador ni a la web publicada.
function discogs(token: string | undefined): Plugin {
  return {
    name: 'discogs',
    configureServer(server) {
      server.middlewares.use('/api/discogs', async (req, res) => {
        const ruta = req.url ?? '';
        if (!/^\/(database\/search\?|releases\/\d+$|masters\/\d+$)/.test(ruta)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        if (!token) {
          res.statusCode = 503;
          res.end('Falta DISCOGS_TOKEN en .env.local');
          return;
        }
        try {
          const r = await fetch(`https://api.discogs.com${ruta}`, {
            headers: { Authorization: `Discogs token=${token}`, 'User-Agent': 'Mediateca/1.0 +https://github.com/ElJuezHolden/mediateca' },
          });
          res.statusCode = r.status;
          res.setHeader('Content-Type', 'application/json');
          // En una edición, se añade cuál de sus fotos es la del disco.
          if (r.ok && ruta.startsWith('/releases/')) {
            const edicion = await r.json();
            const urls = (edicion.images ?? []).map((i: { uri: string }) => i.uri);
            edicion.foto_disco = await buscarFotoDisco(urls);
            res.end(JSON.stringify(edicion));
          } else {
            res.end(await r.text());
          }
        } catch (error) {
          res.statusCode = 502;
          res.end(String(error));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Sin prefijo VITE_: estas variables no se meten en el código del navegador.
  const env = loadEnv(mode, import.meta.dirname, '');
  return {
    // En GitHub Pages la web vive en /<repo>/; en local, en la raíz.
    base: process.env.BASE_PATH ?? '/',
    plugins: [react(), tailwindcss(), guardarColeccion(), discogs(env.DISCOGS_TOKEN?.trim() || undefined)],
    server: {
      port: 3340,
      // Si Vite vigilara la colección, cada guardado recargaría la página.
      watch: { ignored: ['**/public/coleccion.json*'] },
    },
  };
});
