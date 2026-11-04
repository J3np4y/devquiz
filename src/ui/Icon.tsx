const PATHS = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevron: 'M6 9.5l6 6 6-6',
  cross: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  // El mismo símbolo que el icono de la aplicación.
  code: 'M9 6l-6 6 6 6M15 6l6 6-6 6',
} as const;

/** Icono decorativo: el texto que lo acompaña es el que da el significado. */
export function Icon({ name, className }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
