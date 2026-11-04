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

Las pruebas E2E se ejecutan contra la compilación de producción, en escritorio y móvil, e incluyen axe. La primera vez hay que instalar el navegador con `npx playwright install chromium`:

```bash
npm run test:e2e
```

El despliegue a GitHub Pages es automático al subir a `main`.

## Preguntas

Las preguntas están en `content/questions/`, en un archivo YAML por tema. El formato se describe en el [plan](plan.md). Para validarlas y ejecutar los fragmentos verificables (requiere Python):

```bash
npm run content:check
```
