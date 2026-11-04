import { useLayoutEffect } from 'react';

/** Más que un doble clic normal, y menos de lo que se tarda en leer una pantalla nueva. */
export const CLICK_GUARD_MS = 400;

/**
 * Al cambiar de pantalla, ignora el ratón y los toques durante un instante. Sin esto, el segundo
 * clic de un doble clic cae sobre lo que aparece debajo y puede responder una pregunta sin leerla.
 * El teclado sigue funcionando: una tecla no tiene ese problema.
 */
export function useClickGuard(screen: string) {
  useLayoutEffect(() => {
    document.body.classList.add('click-guard');
    const timer = window.setTimeout(() => document.body.classList.remove('click-guard'), CLICK_GUARD_MS);
    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove('click-guard');
    };
  }, [screen]);
}
