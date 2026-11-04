import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'challenge' }
  | { name: 'results'; sessionId: string };

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function parse(hash: string): Route {
  if (hash === '#/reto') return { name: 'challenge' };
  const results = /^#\/resultado\/(.+)$/.exec(hash);
  return results?.[1] ? { name: 'results', sessionId: results[1] } : { name: 'home' };
}

/** La ruta va en el hash para que recargar y el botón Atrás funcionen en GitHub Pages. */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  return parse(hash);
}

export const HOME = '#/';
export const CHALLENGE = '#/reto';
export const resultsHash = (sessionId: string) => `#/resultado/${sessionId}`;

export function navigate(hash: string) {
  window.location.hash = hash;
}
