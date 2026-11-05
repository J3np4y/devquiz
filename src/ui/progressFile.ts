import type { Progress } from '../core/types.ts';

/** Descarga una copia del progreso para guardarla o llevarla a otro dispositivo. */
export function downloadProgress(progress: Progress, now: number) {
  const date = new Date(now);
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  const url = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `devquiz-progreso-${day}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
