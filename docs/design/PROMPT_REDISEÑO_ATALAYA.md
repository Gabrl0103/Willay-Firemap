# Prompt para Claude Code — Rediseño UI de Atalaya

Pega todo lo de abajo en Claude Code (en `willay\willay`).

---

Crea la rama `feat/ui-redesign` desde `main` (verifica antes que `main` esté limpio; `ml/` está excluida en `.git/info/exclude`, no la toques). Solo trabaja en `/mobile` salvo donde se indique. Un commit por fase, los tests deben seguir pasando, textos de UI en español, nombres de código en inglés. Al terminar cada fase dime cómo probarla en el emulador/celular antes de pasar a la siguiente.

## Contexto
La app pasa a llamarse **Atalaya** (antes Willay/FIREMAP). Rediseño estilo Apple, tema oscuro, con fondo de "lámpara de lava" y barra inferior flotante translúcida. Los diseños aprobados están en Claude Design (lienzo "Atalaya Redesign"); aquí van todas las especificaciones para no depender de él.

## Tokens de diseño (crear en la carpeta theme)
- Fondo: `#0B0604`. Texto: `#FFF3EA` (secundario `rgba(255,243,234,0.65)`).
- Acentos: ámbar `#FFB347`, naranja `#FF8A2B`, rojo brasa `#C8360F`; gradiente principal `linear-gradient(90deg,#FFB347,#FF5A1F)`.
- Vidrio: fondo `rgba(255,255,255,0.09)`, borde `1px solid rgba(255,255,255,0.16)`; barra y hojas: `rgba(40,24,16,0.6)` + `backdrop-filter: blur(24px)`.
- Radios: tarjetas 26–32px, hojas inferiores 36px arriba, botones y chips 999px.
- Tipografía: **Manrope** (400–800) para texto y títulos; **Roboto Mono** (400–700) solo para cifras, fechas, años, hectáreas y badges. Instalar con `@fontsource/manrope` y `@fontsource/roboto-mono` (que funcione sin internet en el APK, nada de CDN).
- Colores de riesgo (mantener semántica): Bajo `#4ADE80`, Medio `#FACC15`, Alto `#FF7A1A`, Extremo `#FF3B3B`.

## Fase 0 — Renombrar a Atalaya
- Nombre visible, `appName` de Capacitor, títulos, README y `docs/REQUIREMENTS.md` (nueva versión).
- `appId`: cambiarlo solo si es seguro; si implica regenerar `android/`, explícame el riesgo antes de hacerlo.
- NO cambies la URL de la API (`willay-api.onrender.com`) hasta que yo renombre el servicio en Render. No toques el backend.

## Fase 1 — Sistema visual y componentes compartidos
1. `<app-risk-badge level="low|medium|high|extreme" [label]>`: píldora de vidrio con degradado `linear-gradient(135deg, rgba(C,0.34), rgba(C,0.10))`, borde `1px rgba(C,0.55)`, sombra `inset 0 1px 0 rgba(255,255,255,0.28), 0 0 18px rgba(C,0.28)`, punto de 7px con glow, texto en mayúsculas, 11px, peso 800, `letter-spacing: .12em`, fuente Roboto Mono. Texto claro por nivel (Bajo `#C4F7D8`, Medio `#FFF0B0`, Alto `#FFCFA6`, Extremo `#FFC0C0`). Usarlo en TODOS los lugares donde hoy salen niveles de riesgo.
2. `<app-lava-bg>`: fondo de partículas con DOM+CSS (sin canvas): 10–14 partículas **ovoides** (`border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%`, alto = 1.45 × ancho, tamaños 12–70px, cada una con `rotate` distinto entre −24° y 26°, algunas con `blur(1–2px)`), relleno `radial-gradient(circle at 35% 30%, #FFE2B0 0%, #FF9A3D 35%, #E8431A 75%, #9A2208 100%)`, `box-shadow: 0 0 24px rgba(255,106,43,.55)`, flotando con `@keyframes rise` (translate 10px/−34px, 8–14 s, `ease-in-out infinite`, alternando reverse). Más 2 resplandores grandes con `blur(22px)` y opacidad 0.35–0.5. Debe ir fluido en un Android de gama media; respetar `prefers-reduced-motion`.
3. Barra inferior flotante: `left/right 20px, bottom 28px, alto 72px`. Una píldora de vidrio con 3 ítems (Inicio, Mapa, Historial; icono 24px + etiqueta 11px; el activo con fondo `rgba(255,255,255,0.16)` y color ámbar) + un botón de búsqueda circular de 72px separado a la derecha. Respetar safe-area. Haptics ligeros al cambiar de pestaña (`@capacitor/haptics`).
4. IMPORTANTE: el contenido de cada pantalla debe terminar al menos 24px por encima de la barra (padding inferior = 72 + 28 + 24). Nada debe quedar tapado.
5. Animaciones de entrada reutilizables (clases o directiva) con `cubic-bezier(0.2,0.8,0.2,1)`: `up` (fade + translateY 18px, 0.7 s), `sheet` (fade + translateY 70px, 0.8 s, para hojas y barra), `growy` (scaleY 0→1, origin bottom, barras del gráfico), `growx` (scaleX 0→1, origin left, barras de progreso), `ring` (stroke-dasharray de 0 a su valor, 1.2 s). Entradas escalonadas con delays de 0.1 s entre elementos. Todas desactivadas con `prefers-reduced-motion`.

## Fase 2 — Splash, introducción y Inicio
- **Splash animada** (~2.5 s, luego fade a la app): fondo `#0B0604` con `<app-lava-bg>`; logo horizontal **blanco** (ojo + "Atalaya", peso 800, 58px, `letter-spacing -2.4px`, centrado). Secuencia: el ojo aparece con zoom (scale .7→1, 0.8 s); el texto "Atalaya" se despliega **de derecha a izquierda** (`clip-path: inset(0 0 0 100%) → inset(0)` + translateX 26px→0, 1.1 s, delay 0.7 s); al final, fade de "Riesgo de incendios en Nariño" (delay 1.7 s). Además del splash nativo de Capacitor con el mismo color de fondo.
- **Onboarding** de 3 pantallas, solo la primera vez (flag con `@capacitor/preferences`), botón "Omitir" y "Continuar", puntos de progreso. Pantalla 1: tarjeta de vidrio con ejemplo (badge + puntaje 62 + barra), título "Mira dónde hay riesgo antes de que haya fuego" y aviso de que es un indicador, no una predicción exacta. Pantallas 2 y 3: cómo se calcula (clima 50 %, focos cercanos 30 %, historial 20 %) y permisos.
- **Inicio**: título "Nariño hoy", tarjeta de resumen (riesgo promedio con badge, focos de los últimos 5 días, municipios monitoreados) y carrusel horizontal "Zonas con mayor riesgo" con tarjetas (badge + nombre + puntaje "62 de 100"), con `<app-lava-bg>` detrás. Datos reales de la API, nada inventado.

## Fase 3 — Detalle de zona e Historial
- **Hoja de zona**: botón atrás de vidrio, nombre grande, badge de riesgo, anillo de puntaje con animación `ring`, tres barras de factores (Clima seco 50 %, Focos cercanos 30 %, Historial 20 %) con `growx` escalonado, dos tarjetas (focos a menos de 25 km, incendios por año) y botón "Ver historial".
- **Historial** más explícito: subtítulo con rango real de fechas ("del 1 ene 2019 al <última fecha>"), tarjeta con total de reportes, promedio por año y año máximo; gráfico de barras con TODOS los años completos (2019…) y barras con `growy` escalonado (la barra del máximo con gradiente); lista "Reportes recientes" con bloque de fecha de 58×62px que apila día / mes / año (Roboto Mono, que NO se salga del margen), tipo de evento, vereda o lugar, fuente (UNGRD o Gobernación) y hectáreas aproximadas SI el dato existe (si no, omitirlo). Títulos y lugares con `text-overflow: ellipsis` en una línea. Mantener la nota de fuentes y las atribuciones de licencia (CC BY / CC BY-SA) que ya existen.

## Fase 4 — Mapa con globo
- Reemplazar Leaflet por **MapLibre GL JS** con proyección `globe`, tiles OSM raster con estilo oscuro, los mismos marcadores/colores de riesgo, etiquetas solo a partir de zoom 10, y la misma hoja inferior deslizable.
- Al abrir el mapa: globo con atmósfera naranja tenue, giro lento; luego `flyTo` animado (2–3 s, pitch ~50) hacia Nariño, que queda encuadrado con `maxBounds`.
- Al tocar un municipio o buscar (ej. "Pasto"): `flyTo` con zoom hacia su cabecera y se abre la hoja de zona.
- La hoja inferior del mapa muestra "Departamento de Nariño", conteo de municipios y focos recientes, la leyenda con 4 `app-risk-badge` y el botón "Acercar a Nariño"; debe verse completa sin que la barra inferior la tape (subir la hoja si hace falta).
- Si MapLibre rinde mal en el celular de prueba, dejar un fallback a mapa plano 2D.

## Fase 5 — Logo e icono de la app
Logo "Ojo de vigía" (un ojo con una llama como pupila). SVG base (viewBox 0 0 100 100, `currentColor`):

```svg
<path d="M6 52c13-22 28-32 44-32s31 10 44 32c-13 22-28 32-44 32S19 74 6 52z" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round"/>
<circle cx="50" cy="52" r="25" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.4"/>
<g transform="translate(32.6 38.2) scale(1.45)"><path d="M12 2.5c.8 3.6 5.2 5.4 5.2 10a5.2 5.2 0 0 1-10.4 0c0-2 .9-3.3 2.1-4.3.1 1.9.9 2.9 2 3.3-.3-3 0-6.2 1.1-9z" fill="currentColor"/></g>
```

- Icono de app: fondo `linear-gradient(145deg,#FF9A3D,#C8360F)`, ojo en `#FFF3EA`, ocupando ~66 % central (zona segura para máscaras adaptativas de Android). Generar iconos y splash nativo con `@capacitor/assets` (icono adaptativo con foreground/background y versión monocromática: ojo oscuro `#1A0A03` sobre fondo crema `#FFF3EA`).
- Crear un componente `<app-logo>` (variantes: solo ojo, horizontal blanco, horizontal oscuro) y usarlo en splash, onboarding y cabeceras.

## Reglas
- No romper Historial, atribuciones, tests ni el flujo actual de datos.
- Rendimiento: probar en un Android real; si algo baja de 30 fps, reducir partículas o blur.
- Accesibilidad: `aria-label` en botones de icono, contraste de texto ≥ 4.5:1, objetivos táctiles ≥ 44px.
- Actualizar README y `docs/REQUIREMENTS.md` con una versión nueva al final.