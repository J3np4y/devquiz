# Plan — DevQuiz

Plan de implementación de [requirements.md](requirements.md).

**Estado:** a la espera. Las decisiones están cerradas y el desarrollo no empieza hasta recibir la orden expresa de Oscar.

## Stack

| Área | Elección |
|---|---|
| Aplicación | React, TypeScript y Vite |
| Persistencia | `localStorage`, con esquema versionado |
| Contenido | YAML por tema, validado con Zod al compilar |
| Resaltado de código | Shiki, al compilar, para no cargarlo en el navegador |
| Offline | PWA con `vite-plugin-pwa` |
| Pruebas | Vitest, Playwright y axe |
| CI y despliegue | GitHub Actions y GitHub Pages, en un repositorio nuevo y público, `devquiz` |

## Formato de una pregunta

```yaml
id: js-closures-003
topic: javascript
difficulty: intermedio
type: code            # concept | code
language: javascript
prompt: ¿Qué imprime este código?
code: |
  ...
options:
  - { id: a, text: "..." }
  - { id: b, text: "..." }
correct: b
explanation: ...
verify: true          # CI ejecuta el código y comprueba la respuesta
```

## Fases

| Fase | Trabajo | Listo cuando |
|---|---|---|
| **0. Base** | Primer commit en `main`, crear el proyecto, lint y CI | CI pasa con una app vacía desplegada |
| **1. Contenido** | Esquema, validador, verificador de código y unas 60 preguntas (3 por combinación de tema y nivel) | CI rechaza una pregunta mal formada o con resultado incorrecto |
| **2. Lógica** | Selección de preguntas, ciclo del reto, estadísticas calculadas a partir de las respuestas, persistencia y migración, sin interfaz | Tests unitarios de las reglas de los requisitos |
| **3. Interfaz** | Inicio con filtros y resumen, pregunta con feedback, resultados con revisión, repaso, reanudar y reiniciar con confirmación | Un reto completo funciona en móvil y escritorio (criterios 1 a 6) |
| **4. Accesibilidad y pruebas** | Teclado, foco, `aria-live`, contraste, señales que no dependan solo del color y pruebas E2E | Cada criterio de aceptación tiene su prueba E2E; axe sin errores |
| **5. PWA** | Service worker, instalación, `navigator.storage.persist()` y despliegue | Funciona sin conexión tras la primera visita |
| **6. Banco completo** | Pasar de 60 a unas 150 preguntas, con informe de cobertura por tema y nivel | Cobertura mínima en las 21 combinaciones |

La fase 6 puede avanzar en paralelo desde el final de la fase 1.

## Riesgos

- **Contenido:** es el mayor trabajo del proyecto. Redactar 150 preguntas con buenas opciones incorrectas y explicaciones cuesta más que el código.
- **Revisión:** Claude redacta los borradores y Oscar los revisa. CI solo verifica las preguntas sobre el resultado de un fragmento, así que las conceptuales dependen de esa revisión.
- **Borrado de datos en Safari:** puede eliminar los datos de un sitio tras 7 días de uso sin visitarlo. Las apps instaladas en la pantalla de inicio quedan exentas, y exportar el progreso queda para después del MVP.
