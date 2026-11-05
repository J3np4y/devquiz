# Plan — DevQuiz

Plan de implementación de [requirements.md](requirements.md).

**Estado:** terminado. Las fases 0 a 7 están completas.

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
type: code            # concept | code | truefalse
language: javascript
prompt: ¿Qué imprime este código?
code: |
  ...
options:
  - { id: a, text: "..." }
  - { id: b, text: "..." }
correct: b
explanation: ...
verify: output        # output | error: CI ejecuta el código y comprueba la respuesta
```

Las preguntas `truefalse` no llevan código y usan siempre las opciones `{ id: a, text: "Verdadero" }` y `{ id: b, text: "Falso" }`, en ese orden.

Con `verify: output`, la salida del fragmento debe coincidir exactamente con el texto de la opción correcta. Con `verify: error`, el fragmento debe fallar y el error debe contener ese texto. En SQL, cada fila es una línea y sus columnas se separan con `|`.

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
| **7. Mejoras** | Repetición espaciada, racha diaria, exportar e importar, filtro del repaso, enlace para reportar errores y formato de verdadero o falso | Cada mejora tiene sus pruebas y el formato de los datos guardados no cambia |

La fase 6 puede avanzar en paralelo desde el final de la fase 1.

## Mantenimiento

Dependencias que hoy no se pueden actualizar con normalidad:

- **`overrides` de `package.json`:** fuerzan `minimatch` 11 en los paquetes de ESLint y `glob` 14 en `workbox-build`, para corregir avisos de seguridad de herramientas de desarrollo. Se pueden quitar cuando esos paquetes adopten esas versiones. Forzar `minimatch` 11 sobre `glob` 11 deja el `precache` de la PWA sin HTML, JS ni CSS sin dar error, así que tras tocarlos hay que mirar el número de entradas que indica la compilación.
- **TypeScript 7:** Dependabot lo ignora porque `typescript-eslint` aún no lo admite. Hay que quitar la regla de `.github/dependabot.yml` cuando lo admita.
- **`deepmerge`:** tiene un aviso de nivel bajo sin versión corregida, y solo afecta a la compilación.

## Riesgos

- **Contenido:** es el mayor trabajo del proyecto. Redactar 150 preguntas con buenas opciones incorrectas y explicaciones cuesta más que el código.
- **Revisión:** Claude redacta las preguntas y no hay revisión humana. CI solo verifica el resultado de los fragmentos ejecutables, así que el contenido de las conceptuales depende de la revisión de Claude y puede contener errores que nadie más haya detectado.