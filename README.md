# DevQuiz

Aplicación web para repasar conocimientos de desarrollo en sesiones breves. Funciona sin cuentas ni backend, y guarda el progreso en el dispositivo.

Consulta los [requisitos](requirements.md) y el [plan](plan.md).

## Desarrollo

Requiere Node 24 o superior.

```bash
npm install
```

```bash
npm run dev
```

Antes de subir cambios, ejecuta lint, tipos, tests y build:

```bash
npm run check
```

El despliegue a GitHub Pages es automático al subir a `main`.
