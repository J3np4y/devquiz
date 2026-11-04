# Requisitos — DevQuiz

## Visión

Aplicación web adaptable a móvil para que desarrolladores repasen conocimientos en sesiones breves y mantengan la mente activa. El quiz combinará preguntas conceptuales y ejercicios de lectura de código sobre distintos lenguajes y áreas de desarrollo.

## Decisiones acordadas

- **Plataforma:** aplicación web adaptable a móvil y escritorio, instalable y utilizable sin conexión (PWA).
- **Alojamiento:** sitio estático, sin backend, publicado con GitHub Pages desde un repositorio nuevo y público, `devquiz`.
- **Idioma:** interfaz y preguntas en español, con el código en inglés.
- **Uso:** individual, sin cuentas.
- **Persistencia:** guardar el progreso localmente en el dispositivo.
- **Contenido inicial:** banco de preguntas preparado y revisado, sin generación mediante IA dentro de la aplicación.
- **Autoría del banco:** Claude redacta y revisa las preguntas, sin revisión humana previa a su publicación. CI verifica el formato de todas y el resultado de las que ejecutan código.
- **Tamaño del reto:** hasta 10 preguntas, unos 5 minutos.
- **Banco inicial:** unas 150 preguntas (7 temas × 3 niveles × 7 preguntas).
- **Formato de respuesta:** opción múltiple con una única respuesta correcta. El esquema debe poder ampliarse a otros formatos.
- **Filtros del repaso:** ninguno en el MVP.

## Requisitos funcionales del MVP

### Inicio y selección de retos

- Ofrecer un reto rápido mixto, con al menos 3 temas distintos y un 30 % de preguntas con código.
- Permitir filtrar un reto por tema y nivel de dificultad.
- Si un filtro dispone de menos de 10 preguntas, iniciar el reto con las disponibles y avisarlo. Si no hay ninguna, mostrar un mensaje claro y no iniciar el reto.
- Priorizar las preguntas no vistas y, después, las vistas hace más tiempo.
- Incluir un modo para repasar preguntas falladas anteriormente: hasta 10 preguntas, primero las falladas hace más tiempo. Si no hay ninguna, el acceso queda desactivado y se explica el motivo.
- Mostrar un resumen del progreso: preguntas respondidas, precisión global, precisión por tema y retos completados.

### Preguntas y respuestas

- Soportar preguntas conceptuales y preguntas sobre qué hace un fragmento de código o cuál es su resultado.
- Organizar las preguntas por tema y dificultad. El tema es el único eje de filtrado; el lenguaje es un dato del fragmento de código, usado para presentarlo.
- Incluir tres niveles: principiante, intermedio y avanzado.
- Mostrar opciones de respuesta en orden aleatorio y permitir responder sin límite de tiempo.
- Una respuesta dada no se puede cambiar.
- Después de cada respuesta, indicar si es correcta y mostrar una explicación breve.
- Permitir avanzar por el reto y salir de él.

### Salida y reanudación

- Al salir de un reto o recargar la aplicación, las respuestas dadas se conservan y el reto no cuenta como completado.
- Al volver, se ofrece reanudar el reto en curso o descartarlo. Descartarlo no borra las respuestas ya dadas.

### Resultados y repaso

- Al completar un reto, mostrar el total de respuestas correctas.
- Permitir revisar las preguntas de la sesión, la respuesta elegida, la respuesta correcta y su explicación. La respuesta correcta se muestra siempre y la elegida se resalta si es errónea.
- Guardar las preguntas falladas para facilitar su repaso posterior.
- Una pregunta deja de estar fallada al acertarla una vez, en cualquier modo. Vuelve a la lista si se falla de nuevo.

### Métricas

- **Precisión:** aciertos / preguntas respondidas.
- Las preguntas respondidas, la precisión y los retos completados contabilizan solo los retos normales. El repaso no cuenta, porque repite preguntas elegidas por haberse fallado.

### Progreso y privacidad

- Persistir localmente las sesiones, respuestas y preguntas falladas. Las métricas se calculan a partir de esos datos.
- Permitir reiniciar el progreso guardado, previa confirmación.
- Versionar el formato de los datos guardados y migrarlos al cambiar de versión.
- Seguir funcionando si los datos están corruptos o el almacenamiento no está disponible, avisando de que el progreso no se guardará.
- Ignorar sin error el historial de preguntas que ya no existan en el banco.
- Solicitar almacenamiento persistente al navegador cuando esté disponible.
- No solicitar ni almacenar datos personales en el MVP.
- No incluir analítica ni cargar recursos de terceros (CDN, fuentes externas).
- No requerir backend, cuenta ni sincronización entre dispositivos.

### Experiencia de uso

- Adaptar la interfaz a móvil y escritorio.
- Seguir la preferencia de tema claro u oscuro del sistema.
- Mantener una navegación clara y permitir el uso mediante teclado: `1-4` para responder, `Enter` para avanzar y foco gestionado al cambiar de pantalla.
- Anunciar el resultado de cada respuesta a los lectores de pantalla y no depender solo del color para indicarlo.
- Presentar los fragmentos de código de forma legible, con resaltado de sintaxis y scroll horizontal, sin ajuste de línea.
- Funcionar sin conexión tras la primera visita.

## Contenido inicial

El banco de preguntas cubrirá estos temas, en este orden de prioridad:

1. JavaScript.
2. Python.
3. SQL.
4. Fundamentos y estructuras de datos.
5. Testing.
6. Principios de diseño y programación.
7. Arquitectura de software.

Se busca al menos un 40 % de preguntas con código en los temas donde aplique.

Cada pregunta debe incluir, como mínimo, un identificador estable, tema, dificultad, tipo, enunciado, opciones con identificador propio, respuesta correcta y explicación. Las preguntas con código incluirán además el fragmento y su lenguaje.

Reglas de contenido:

- El identificador de una pregunta no cambia nunca, y el de una pregunta eliminada no se reutiliza.
- La respuesta correcta se referencia por el identificador de la opción, no por su posición.
- No se usan opciones que dependan del orden, como "todas las anteriores".
- Los fragmentos se escriben para versiones fijadas: Node LTS, Python 3.12 y SQLite.
- Las preguntas sobre el resultado de un fragmento se verifican automáticamente en CI ejecutando el código, salvo que el resultado no sea determinista.

## Criterios de aceptación

1. Se puede iniciar un reto mixto o uno filtrado por tema y dificultad. Un filtro con pocas preguntas o sin ninguna se comporta según lo descrito.
2. El reto mixto presenta al menos 3 temas, un 30 % de preguntas con código y más de un nivel de dificultad.
3. Cada respuesta recibe feedback y una explicación antes de continuar.
4. El resumen permite revisar las respuestas y entender los errores.
5. Las preguntas falladas se pueden iniciar en un reto de repaso, y salen de la lista al acertarlas.
6. El progreso, incluido un reto en curso, se conserva al recargar la aplicación en el mismo dispositivo y se puede reiniciar previa confirmación.
7. Las pantallas principales se pueden usar en móvil y escritorio y recorrer con teclado según lo descrito, sin errores de accesibilidad detectados por axe.
8. La aplicación funciona sin conexión tras la primera visita.
9. CI rechaza una pregunta mal formada o cuyo resultado verificado no coincida con la respuesta marcada.

## Fuera del alcance inicial

- Registro, inicio de sesión, backend y sincronización.
- Generación de preguntas mediante IA dentro de la aplicación.
- Rankings, competición o publicación de preguntas por usuarios.
- Un catálogo exhaustivo de preguntas; el banco se ampliará gradualmente.

## Ideas para después del MVP

- Repetición espaciada.
- Racha diaria.
- Exportar e importar el progreso.
- Más formatos de respuesta.
- Enlace para reportar preguntas erróneas.
- Filtros en el repaso.
