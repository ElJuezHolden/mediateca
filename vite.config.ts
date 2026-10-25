import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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

export default defineConfig({
  // En GitHub Pages la web vive en /<repo>/; en local, en la raíz.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), guardarColeccion()],
  server: {
    port: 3340,
    // Si Vite vigilara la colección, cada guardado recargaría la página.
    watch: { ignored: ['**/public/coleccion.json*'] },
  },
});
