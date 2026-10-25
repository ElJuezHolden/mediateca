import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, X } from 'lucide-react';
import { comprobarDiscogs, comprobarGithub, guardarToken, leerToken, REPO } from '../sesion';

interface Props {
  onCerrar: () => void;
  /** Tras entrar o salir, para recargar la colección y los permisos. */
  onCambio: () => void;
}

/** Acceso para editar desde la web publicada: los tokens de GitHub y Discogs. */
export function Acceso({ onCerrar, onCambio }: Props) {
  const conAcceso = !!leerToken('github');
  const [github, setGithub] = useState('');
  const [discogs, setDiscogs] = useState('');
  const [comprobando, setComprobando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setComprobando(true);
    setError('');
    try {
      if (github.trim()) await comprobarGithub(github);
      if (discogs.trim()) await comprobarDiscogs(discogs);
      if (github.trim()) guardarToken('github', github);
      if (discogs.trim()) guardarToken('discogs', discogs);
      onCambio();
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setComprobando(false);
    }
  }

  function salir() {
    guardarToken('github', '');
    guardarToken('discogs', '');
    onCambio();
    onCerrar();
  }

  const etiqueta = 'mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--suave)]';
  const enlace = 'inline-flex items-center gap-1 normal-case tracking-normal text-[var(--acento)] hover:underline';

  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form
        onSubmit={entrar}
        className="ventana relative flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--borde)] bg-[var(--panel)] p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl tracking-wide">Acceso para editar</h2>
          <button type="button" className="rounded-full p-1.5 text-[var(--suave)] hover:text-white" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-[var(--suave)]">
          {conAcceso
            ? 'Este navegador ya puede editar. Puedes cambiar los tokens o salir.'
            : 'Pega tus tokens una vez en cada dispositivo. Se guardan solo en este navegador; quien no los tenga sigue viendo la web en solo lectura.'}
        </p>

        <label>
          <span className={etiqueta}>
            Token de GitHub {conAcceso && '(ya puesto)'}
            <a className={enlace} href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
              Crearlo <ExternalLink size={12} />
            </a>
          </span>
          <input
            className="campo"
            type="password"
            autoComplete="off"
            placeholder={conAcceso ? 'Déjalo vacío para mantener el actual' : 'github_pat_…'}
            value={github}
            onChange={(e) => setGithub(e.target.value)}
            required={!conAcceso}
          />
          <span className="mt-1.5 block text-xs leading-relaxed text-[var(--suave)]">
            Con la cuenta JuezHolden: <b>Resource owner</b> ElJuezHolden · <b>Repository access</b> «Only select repositories» →{' '}
            {REPO.split('/')[1]} · <b>Permissions</b> → Contents: «Read and write».
          </span>
        </label>

        <label>
          <span className={etiqueta}>
            Token de Discogs {leerToken('discogs') ? '(ya puesto)' : '(para los discos)'}
            <a className={enlace} href="https://www.discogs.com/settings/developers" target="_blank" rel="noreferrer">
              Verlo <ExternalLink size={12} />
            </a>
          </span>
          <input
            className="campo"
            type="password"
            autoComplete="off"
            placeholder={leerToken('discogs') ? 'Déjalo vacío para mantener el actual' : 'El mismo de .env.local'}
            value={discogs}
            onChange={(e) => setDiscogs(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          {conAcceso && (
            <button type="button" className="boton mr-auto" onClick={salir}>
              Salir en este navegador
            </button>
          )}
          <button type="button" className="boton" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton boton-acento" disabled={comprobando || (conAcceso && !github.trim() && !discogs.trim())}>
            {comprobando && <Loader2 size={15} className="animate-spin" />} {conAcceso ? 'Guardar' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
