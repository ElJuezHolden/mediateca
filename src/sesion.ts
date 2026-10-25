// Acceso para editar desde la web publicada. Los tokens se guardan solo en el
// navegador de cada dispositivo (localStorage) y nunca salen de él salvo hacia
// GitHub y Discogs.

export const REPO = 'ElJuezHolden/mediateca';
export const RAMA = 'main';
export const ARCHIVO = 'public/coleccion.json';
/** Firma de los commits hechos desde la web, la misma que en local. */
export const FIRMA = { name: 'ElJuezHolden', email: 'elmaildeljuezholden@gmail.com' };

type Clave = 'github' | 'discogs';
const CLAVES: Record<Clave, string> = { github: 'mediateca-token-github', discogs: 'mediateca-token-discogs' };

export function leerToken(clave: Clave): string {
  try {
    return localStorage.getItem(CLAVES[clave]) ?? '';
  } catch {
    return '';
  }
}

export function guardarToken(clave: Clave, valor: string) {
  try {
    if (valor.trim()) localStorage.setItem(CLAVES[clave], valor.trim());
    else localStorage.removeItem(CLAVES[clave]);
  } catch {
    /* sin almacenamiento: habrá que pegarlo cada vez */
  }
}

/** En local siempre se edita; en la web publicada, con el token de GitHub. */
export function puedeEditar() {
  return import.meta.env.DEV || !!leerToken('github');
}

/** Comprueba que el token de GitHub puede escribir en el repo de la Mediateca. */
export async function comprobarGithub(token: string): Promise<void> {
  const r = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/vnd.github+json' },
  });
  if (r.status === 401) throw new Error('GitHub no reconoce ese token (¿está bien copiado o ha caducado?).');
  if (!r.ok) throw new Error(`GitHub: HTTP ${r.status}. ¿El token tiene acceso al repo ${REPO}?`);
  const repo: { permissions?: { push?: boolean } } = await r.json();
  if (!repo.permissions?.push) throw new Error('Ese token puede leer el repo pero no escribir: dale permiso «Contents: Read and write».');
}

/** Comprueba que el token de Discogs funciona. */
export async function comprobarDiscogs(token: string): Promise<void> {
  const r = await fetch(`https://api.discogs.com/oauth/identity?token=${encodeURIComponent(token.trim())}`).catch(() => null);
  if (!r?.ok) throw new Error('Discogs no reconoce ese token.');
}
