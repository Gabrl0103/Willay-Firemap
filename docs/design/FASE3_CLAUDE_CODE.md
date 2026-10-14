# Fase 3 — Detalle de zona e Historial (para Claude Code + image-to-code)

Pega esto en Claude Code, en `willay\willay`, rama `feat/ui-redesign`. Fases 0, 1 y 2 ya están commiteadas. Antes de empezar corre `npm test` en `mobile` y confirma que pasa.

## Capturas a reproducir (usa la skill image-to-code con cada una)
- `docs/design/5 · Detalle de zona@2x.png`
- `docs/design/6 · Historial@2x.png`

La captura manda para espaciados, tamaños, jerarquía y posiciones. `docs/design/PROMPT_REDISEÑO_ATALAYA.md` (sección Fase 3) manda para colores, tipografías y animaciones. Si chocan, dímelo en vez de elegir tú.

## Reglas
- Solo `/mobile`. No toques backend, `ml/` ni la URL de la API. Textos en español, nombres de código en inglés.
- Reusa tokens y componentes ya hechos (`<app-risk-badge>`, `<app-lava-bg>`, clases `anim-*`, `--nav-clearance`). No dupliques estilos.
- Datos reales (`ZoneDetail`, `FireHistory`, stores existentes). Si un dato no existe, omite esa parte de la UI y avísame; no inventes.
- Cifras, fechas, años, hectáreas y badges en Roboto Mono.
- No romper la mecánica de la hoja (arrastre, snaps, `sheet-snap.ts`) ni sus tests. Mantén las atribuciones de licencia (CC BY / CC BY-SA) y la nota de fuentes.
- Contenido siempre por encima de la barra flotante. `prefers-reduced-motion` respetado.
- Un commit para la fase. Tests en verde. Si cambias un test existente, explica por qué.

## Tareas
1. **Hoja de zona** (`zone-sheet`): botón atrás de vidrio, nombre grande, badge de riesgo, anillo de puntaje con animación `ring` (define `--ring-value` y `--ring-total`), tres barras de factores (Clima seco 50 %, Focos cercanos 30 %, Historial 20 %) con `growx` escalonado, dos tarjetas (focos a menos de 25 km, incendios por año) y botón "Ver historial" con el gradiente principal. Quita lo que la captura ya no muestra (cabecera con líneas de terreno, grilla de clima) solo si la captura lo omite; si los datos del clima conviven en el diseño, avísame antes de borrarlos.
2. **Historial**: subtítulo con el rango real de fechas ("del 1 ene 2019 al <última fecha>"); tarjeta con total de reportes, promedio por año y año máximo; gráfico de barras con TODOS los años completos desde 2019 y barras con `growy` escalonado (la del máximo con gradiente); lista "Reportes recientes" con bloque de fecha de 58×62 px que apila día / mes / año (Roboto Mono, sin salirse del margen), tipo de evento, vereda o lugar, fuente y hectáreas aproximadas solo si el dato existe. Títulos y lugares con `text-overflow: ellipsis` en una línea.
3. Pasa el estilo de `fire-event-tile` y `data-attribution` al tema nuevo.
4. Actualiza/añade tests de lo nuevo (cálculos de promedio por año, año máximo, rango de fechas, años completos sin huecos).

## Al terminar
Dime cómo probarlo (navegador y celular), qué diferencias con las capturas quedaron y las dudas que hayas tenido que resolver tú.
