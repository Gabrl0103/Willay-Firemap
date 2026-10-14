# Fase 2 — Splash, introducción e Inicio (para Claude Code + image-to-code)

Pega esto en Claude Code, en `willay\willay`, rama `feat/ui-redesign`. La Fase 0 y 1 ya están hechas y commiteadas (tokens, `<app-risk-badge>`, `<app-lava-bg>`, barra flotante, animaciones `anim-*`). Antes de empezar corre `npm test` en `mobile` y confirma que pasa.

## Capturas a reproducir (usa la skill image-to-code con cada una)
- `docs/design/1 · Splash@2x.png`
- `docs/design/2 · Introducción@2x.png`
- `docs/design/3 · Inicio@2x.png`
- `docs/design/7 · Logo Atalaya@2x.png` (referencia del logo)

La captura manda para espaciados, tamaños, jerarquía y posiciones. Las especificaciones de `docs/design/PROMPT_REDISEÑO_ATALAYA.md` (sección Fase 2 y Fase 5 para el logo) mandan para colores, tipografías y animaciones. Si una captura y el prompt chocan, dímelo en vez de elegir tú.

## Reglas
- Solo `/mobile`. No toques backend ni `ml/`. No cambies la URL de la API.
- Textos en español, nombres de código en inglés. Reusa los tokens y componentes de la Fase 1; no dupliques estilos.
- Datos reales de los stores/repositorios existentes (zones, hotspots). Nada inventado: si un dato no existe, omite esa parte de la UI y avísame.
- Los números, fechas y badges van en Roboto Mono. Contenido siempre por encima de la barra (`--nav-clearance`).
- Un commit para esta fase. Tests en verde. `prefers-reduced-motion` respetado.

## Tareas
1. **`<app-logo>`** (variantes: solo ojo, horizontal blanco, horizontal oscuro) con el SVG del prompt (Fase 5). Se usa ya en Splash y onboarding.
2. **Splash animada** (~2.5 s, luego fade a la app): secuencia exacta del prompt (ojo con zoom, texto "Atalaya" de derecha a izquierda, subtítulo "Riesgo de incendios en Nariño" al final) sobre `<app-lava-bg>`. Cambia el color de fondo del splash nativo de Capacitor a `#0B0604`.
3. **Onboarding** de 3 pantallas, solo la primera vez (`@capacitor/preferences`; instálalo), con "Omitir", "Continuar" y puntos de progreso, como en la captura 2.
4. **Inicio**: nueva ruta `/home` como pantalla por defecto (`''` redirige a `home`). "Nariño hoy", tarjeta de resumen (riesgo promedio con badge, focos de los últimos 5 días, municipios monitoreados) y carrusel "Zonas con mayor riesgo", con `<app-lava-bg>` detrás y animaciones `anim-up` escalonadas.
5. **Barra inferior**: agrega el ítem Inicio (primero). Cambia el icono de Historial al de barras de la captura (ícono nuevo en `app-icon`).
6. Botón de ajustes arriba a la derecha del Inicio: solo visual por ahora (sin función) o quítalo y dime.

## Al terminar
Dime cómo probarlo (navegador y celular) y qué diferencias con las capturas quedaron. Si algo te pareció impreciso, lista las dudas antes de inventar.
