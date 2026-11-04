// Es un .ts, no un .d.ts, para que el compilador lo compruebe: skipLibCheck ocultaba sus errores.
declare module 'virtual:bank' {
  const bank: import('./ui/labels.ts').AppQuestion[];
  export default bank;
}
