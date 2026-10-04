# Willay — Requisitos y decisiones

*(Antes llamado FIREMAP. **Willay** viene del quechua/kichwa: "avisar, contar, anunciar" — la app avisa dónde hay riesgo de incendio. Confirmar el significado y la escritura con un hablante o una fuente local.)*

> Documento vivo. Se actualiza al cierre de cada sesión. Al iniciar una sesión nueva, pega este archivo (o léelo del proyecto) para retomar el contexto.
> **Última actualización:** 2026-10-04 · **Versión:** 0.20 (focos FIRMS: 5 días, NOAA-21 y peso por antigüedad)

---

## 1. Resumen

App **solo móvil** que muestra el riesgo de incendio forestal por zonas de Nariño (Colombia). Un backend recolecta datos por **scraping** (más APIs abiertas) y calcula un **puntaje de riesgo** por zona para las próximas horas/días.

- **Contexto:** proyecto académico, se presenta al profesor.
- **Plazo:** ~1 mes, producto funcional y desplegado.
- **Restricciones del profesor:** el scraping es obligatorio y **el tipo de fuente no importa** mientras se haga scraping; predecir el incendio directamente es demasiado complejo, así que se estima **riesgo**. El profesor **no impuso stack**.
- **Idioma de trabajo:** español. Código, clases, variables y commits en inglés.

## 2. Alcance

**Dentro:** app móvil Android (APK), backend API, scraping programado, cálculo de riesgo, mapa.
**Fuera (por ahora):** escritorio, wearables, iOS, login, reportes ciudadanos, notificaciones push, deep learning.

## 3. Stack (decidido)

| Capa | Tecnología | Por qué |
|---|---|---|
| App móvil | Ionic + Angular + Capacitor (Android) | Es web empaquetada como APK; permite reutilizar el CSS del prototipo de Lovable. |
| Backend | Node.js + Express + TypeScript | Sencillo; mismo lenguaje que la app. |
| Scraping | `axios` + `cheerio`, programado con `node-cron`, dentro del backend | Un solo lenguaje, sin servicios extra. |
| Base de datos | PostgreSQL + PostGIS en **Neon** | PostGIS soportado (`CREATE EXTENSION postgis;`). El plan gratis duerme a los 5 min sin uso y reactiva en unos cientos de ms. |
| Mapa | OpenStreetMap + Leaflet | Gratis, sin facturación (Google Maps descartado). |
| Ubicación | Plugin Geolocation de Capacitor | Botón "Mi ubicación". |
| Estilos | CSS con variables (los tokens de Lovable); Tailwind opcional | Reutiliza el prototipo. |
| Hosting | Render o Railway (backend); APK para la app | Vercel descartado. |

**Descartados:** Java/Spring Boot + React/Tailwind (sin necesidad) y Flutter + FastAPI (se cambió de stack por reutilizar el diseño web y usar un solo lenguaje).

**Riesgo conocido:** Angular tiene curva de aprendizaje alta. Alternativa si pesa demasiado: Ionic con React, sin cambiar el resto del stack.

## 4. Arquitectura y buenas prácticas (obligatorias)

- **Clean Architecture completa**, en backend y en la app. Dependencias siempre hacia adentro; el dominio no conoce frameworks.
- **SOLID, DRY, KISS.**
- **Patrones donde aporten:** Repository (acceso a datos), Factory (crear scrapers/clientes), Dependency Injection (inyección de Angular en la app; contenedor de composición manual en Express), Singleton (pool de conexión a la base, servicios `providedIn: 'root'`), Observer (RxJS `Observable` en la app; eventos de ingesta en el backend).
- **Manejo global de excepciones:** middleware de errores en Express; `HttpInterceptor` y errores tipados en Angular.
- **Tipado fuerte:** TypeScript con `strict: true`, interfaces y DTOs en ambos lados. Sin `any`.
- **Nomenclatura en inglés:** camelCase para variables y métodos, PascalCase para clases e interfaces.
- **Design System:** tokens CSS (variables) y componentes reutilizables (`RiskBadge`, `ZoneMarker`…).
- **Scraping respetuoso:** robots.txt, intervalos razonables, caché.

## 5. Estructura de carpetas (propuesta)

```
willay/
├── backend/                       # Express + TypeScript
│   └── src/
│       ├── domain/                # entities, value objects, ports (interfaces)
│       │   └── services/          # RiskScoringService (lógica pura)
│       ├── application/           # use cases
│       ├── infrastructure/
│       │   ├── persistence/       # repositories (Neon/PostGIS)
│       │   ├── external/          # clientes FIRMS, Open-Meteo
│       │   ├── scraping/          # scrapers (axios + cheerio) y programador
│       │   └── config/            # env, contenedor de dependencias
│       └── presentation/          # routes, controllers, DTOs, error middleware
├── mobile/                        # Ionic + Angular + Capacitor
│   └── src/app/
│       ├── core/                  # interceptors, error handling, config
│       ├── domain/                # models, repository interfaces
│       ├── data/                  # API services, repository implementations
│       ├── presentation/          # pages (map, history), components
│       └── theme/                 # tokens CSS (design system)
├── database/                      # schema.sql, functions.sql, seeds
└── docs/                          # este archivo, mockups
```

## 6. Fuentes de datos

**Scraping (obligatorio, propuesta):**

| Fuente | Qué aporta | Estado |
|---|---|---|
| Noticias locales: boletines de la Gobernación de Nariño (narino.gov.co) | Incendios recientes (2024–hoy): fecha, municipio, vereda, a veces hectáreas | `robots.txt` revisado (2026-10-01): `User-agent: *` → `Allow: /`, `Crawl-delay: 3`. Se lee el feed RSS de su buscador (`/search/incendio/feed/rss2/`, hasta 8 páginas de 10 noticias con el texto completo; para en la primera página vacía). Auditoría 2026-10-04: el buscador solo tiene **55 noticias** (6 páginas, la más antigua del 2024-01-24; nada de 2023); 41 son de 2026. Con 5 páginas se leían 50: 9 incendios forestales, 0 perdidos por zona, agrupados en 4 incendios; se perdían la página 6 (cerro El Cundur, Chachagüí, 2024-09-15) y 2 notas con "incendios" en plural (Santacruz, Ancuya). Desde v0.18: 8 páginas y el plural cuenta si el título nombra un municipio (sin tomar hectáreas: esas notas citan totales del departamento). Corrida 2026-10-04: 55 leídas, 12 incendios forestales, 3 nuevos guardados (7 noticias en total). **Diario del Sur** dio 0 resultados y se quitó. **HSB Noticias** ya resuelve DNS y su `robots.txt` permite `*`, pero bloquea por nombre a agentes de IA (`Claude-User`, `ClaudeBot`), así que el asistente no revisó su HTML; queda como candidata. |
| Datos abiertos UNGRD: "Emergencias UNGRD" en datos.gov.co, tres datasets: `wwkg-r6te` (2019–2022, CC BY-SA 4.0), `rgre-6ak4` (2023–2024, CC BY-SA 4.0) y `2343-nuqp` (2025, CC BY 4.0) | Histórico 2019–2025 con municipio, DIVIPOLA, evento y hectáreas | Implementado y probado. `robots.txt` de datos.gov.co permite `/resource/` (Crawl-delay 1). Una fuente por dataset; se aceptan los dos nombres del evento (`INCENDIO DE COBERTURA VEGETAL` hasta 2022, `INCENDIO FORESTAL` desde 2023). Corrida 2026-10-04: 266 + 477 + 198 filas de Nariño, todas en alguna zona; quedan 177 + 423 + 94 eventos por la llave zona+lugar+fecha (el dataset de 2025 trae cada fila dos veces). **Atribución** (exigida por las licencias): autor UNGRD, fuente datos.gov.co, licencia y cambios hechos (solo incendios forestales de Nariño, reportes del mismo día y municipio unidos); se muestra al final de la pantalla Historial. CC BY-SA pide que, si se publica una base derivada de 2019–2024, se comparta con la misma licencia. |
| IDEAM: puntos de calor y estadísticas de incendios | Focos y estadísticas | Candidato, sin verificar si hay datos descargables. |

**APIs abiertas (tiempo real):** NASA FIRMS (focos de calor: VIIRS SNPP, NOAA-20 y NOAA-21 NRT, últimos 5 días UTC, bbox de Nariño `-79.1,0.35,-76.8,2.7`), Open-Meteo (clima, sin API key).

**Límites de zonas:** GeoJSON de municipios/veredas de Nariño (IGAC o DANE). *Bloqueante actual: sin esto no se puebla la tabla de zonas.*

**Notas:**
- Las noticias hay que procesarlas: extraer texto, detectar municipio/lugar y guardarlo como evento histórico.
- Falta confirmar con el profesor que las noticias y los datos abiertos cuentan como scraping válido.

## 7. Modelo de riesgo

- **V1:** puntaje ponderado por zona (0–100) → nivel Bajo 0–24 / Medio 25–49 / Alto 50–74 / Extremo 75–100.
- **Puntaje** = 0,5 × clima seco + 0,3 × focos cercanos + 0,2 × historial. Cada factor va de 0 a 100:
  - **Clima seco** (Open-Meteo): 0,3 × temperatura (10→32 °C) + 0,35 × sequedad (humedad 80→20 %) + 0,15 × viento (0→40 km/h) + 0,2 × días sin lluvia (0→14).
  - **Focos cercanos** (NASA FIRMS, últimos 5 días desde v0.20; antes 2): focos a 25 km o menos del municipio, cada uno con un **peso por antigüedad**: 1 hasta los 2 días (la ventana anterior) y luego baja en línea recta hasta 0 a los 5 días (3 días → 0,67; 4 días → 0,33). Suma de pesos 3 o más = 100 (umbral sin cambio). Así, ampliar la ventana no cambia el factor para incendios recientes y los focos de 3–5 días solo suman un poco. Constantes en `backend/src/domain/service/hotspotRecency.ts`. NOAA-21 agrega pasadas: un mismo incendio puede salir en hasta 3 satélites, así que el conteo sube algo frente a v0.19.
    - Antes → después (2026-10-04 07:13 UTC, 13 focos en 5 días: 11 del 30-sep, 1 del 1-oct, 1 del 3-oct): con la ventana de 2 días no había focos (factor 0 en las 64 zonas). Con la nueva, 14 zonas tienen focos a 25 km; las 7 con 4 focos de ~3,5 días (La Unión, La Cruz, Arboleda, San Bernardo, Belén, San Pedro de Cartago, San Lorenzo) pasan a factor 55 (sin el peso serían 100) y, p. ej., La Unión sube de 20 a 37 (Medio). Sin peso, la ventana de 5 días habría llevado esas zonas a 47–50.
  - **Historial** (scraping: UNGRD + noticias): **incendios por año** de la zona en todo el registro, desde el 2019-01-01 hasta hoy; **2,8 incendios por año = 100** (tope, desde v0.19; antes 1). No usa una ventana reciente porque las fuentes cubren años distintos (UNGRD 2019–2022, noticias desde 2026): con la ventana anterior de 730 días solo 4 de 64 zonas tenían historial. Con la tasa anual, 46 zonas tienen historial > 0 y 5 llegan a 100 (Albán, Buesaco, Cumbal, Ipiales, La Cruz), así que suma de 0 a 20 puntos (2026-10-01).
    - **Tope = p90 (v0.19, 2026-10-04):** con UNGRD 2019–2025 hay 701 incendios; la tasa por zona tiene mediana 1,03, p90 2,84 (rango más cercano: La Unión, 22 incendios en 7,76 años) y máximo 9,93 (Pasto). Con el tope anterior (1) **36 de 64 zonas quedaban en 100**. El tope pasa a **2,8** (p90 redondeado hacia abajo), constante `FIRES_PER_YEAR_FOR_MAX` en `RiskScoringService.ts`. Se calcula una vez y se deja fija: si se recalculara en cada petición, el puntaje de una zona cambiaría cuando otras reciben reportes. Se revisa a mano cuando el registro cambie mucho. Pesos sin cambio (0,5 / 0,3 / 0,2).
    - Antes → después (mismos datos del 2026-10-04): zonas con historial 100: 36 → 8; en 0: 11 → 11; mediana del factor: 100 → 37. Puntaje máximo: 25 (Ancuya y Mallama, nivel Medio) → 21 (Buesaco); las 64 zonas en Bajo porque el clima está húmedo y no hay focos (FIRMS devolvió 0).
- **Limitaciones del historial:**
  - **Mide incendios reportados, no incendios ocurridos.** Cuenta lo que llegó a la UNGRD (reportes de los consejos municipales de gestión del riesgo y bomberos) y a los boletines de la Gobernación. Los municipios grandes (Pasto, Ipiales, Chachagüí, cerca de la capital) tienen más población, más bomberos y más cobertura de prensa, así que reportan más; los municipios rurales o de la costa pueden tener incendios que nunca se reportan. El factor mezcla frecuencia de incendios con capacidad de reporte.
  - UNGRD pierde reportes del mismo día en un municipio: la regla anti-duplicados (zona, lugar, fecha) usa como lugar el nombre del municipio. 2019–2022: 266 filas → 177 eventos; 2023–2024: 477 → 423; 2025: 198 → 94 (ahí son filas repetidas en el dataset).
  - Las noticias subestiman los años recientes: solo hay una fuente (boletines de la Gobernación), que no reporta todos los incendios. Desde v0.18 la UNGRD cubre 2019–2025; 2026 solo tiene noticias.
- **Salida:** riesgo estimado para 24–72 h y los factores que más pesaron.
- **Mejora opcional:** regresión logística con el histórico si sobra tiempo. Deep learning descartado.

## 8. Requisitos funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Ver mapa de Nariño con zonas coloreadas por nivel de riesgo | Must |
| RF-02 | Ver detalle de zona: puntaje, nivel, clima actual, factores del riesgo | Must |
| RF-03 | Ver focos de calor recientes sobre el mapa | Must |
| RF-04 | Ver historial de incendios por municipio (datos del scraping) | Must |
| RF-05 | Buscar municipio y ir a su zona | Should |
| RF-06 | Botón "Mi ubicación": ver el riesgo donde está el usuario | Should |
| RF-07 | Pantalla "Cómo se calcula el riesgo" | Fuera del MVP (opcional si sobra tiempo) |

### Pantallas del MVP

1. **Mapa (home):** mapa oscuro con zonas por color, focos de calor, buscador arriba y botón de ubicación.
2. **Detalle de zona** (bottom sheet o pantalla): puntaje 0–100, nivel, clima, factores.
3. **Historial:** lista de incendios pasados del municipio, con fecha, lugar y hectáreas.

Navegación: barra inferior con Mapa e Historial.

### Estilo visual (decidido: prototipo de Lovable)

Referencia oficial: el prototipo generado en Lovable (3 pantallas: Mapa, Detalle de zona, Historial). Los valores vienen del CSS real del prototipo (convertidos de OKLCH a hex).

**Concepto:** cartografía topográfica. El mapa es oscuro y las tarjetas y listas son claras, con acento rojo ladrillo. Es una mezcla, no un dashboard 100% oscuro.

**Tokens de color:**

| Token | Hex | Uso |
|---|---|---|
| `background` | `#F5F3EF` | Fondo de la pantalla Historial |
| `card` | `#FEFDFC` | Tarjetas, hoja inferior, barra de navegación |
| `foreground` | `#0E1518` | Texto principal |
| `muted-foreground` | `#536064` | Texto secundario |
| `secondary` | `#F2F0EC` | Pestaña activa, pistas de barras, contadores |
| `secondary-foreground` | `#182A2F` | Etiqueta "UNGRD" |
| `primary` | `#9C3F26` | Rojo ladrillo: logo, botón principal, íconos de acento |
| `primary-foreground` | `#FDFCF9` | Texto sobre primary |
| `accent` | `#F1DEC9` | Beige: bloques de ícono, etiqueta "Noticias" |
| `accent-foreground` | `#492517` | Texto sobre accent |
| `border` | `#BECED1` | Bordes y divisores finos |
| `map` | `#2C474E` | Mapa, parte clara del degradado |
| `map-deep` | `#09232A` | Mapa, parte oscura del degradado |
| `map-foreground` | `#F9F9F4` | Texto sobre el mapa |
| `map-line` | `#BFD5D0` al 28 % | Líneas topográficas |
| Nariño (relleno) | `#35655C` al 58 % | Polígono de Nariño |
| Nariño (contorno) | `#B1D4C8` al 48 % | Contorno del polígono |
| `risk-low` | `#2E8F5B` | Bajo |
| `risk-medium` | `#D59800` | Medio |
| `risk-high` | `#DD5400` | Alto |
| `risk-extreme` | `#C21725` | Extremo |

Degradado del mapa: 165°, de `map` a `map-deep` (66 %). Cubierta de la hoja de detalle: 160°, mismos colores.

**Tipografía:** títulos y números grandes en **Archivo** (peso 800); cuerpo en **IBM Plex Sans**. Ambas están en Google Fonts (se instalan con `@fontsource` para que funcionen sin internet en el APK).
- Logo "Willay": Archivo 800, 18 px.
- Título de pantalla Historial: Archivo 800, 28 px.
- Nombre de zona en el detalle: Archivo 800, 29 px. Puntaje: Archivo 800, 27 px.
- Cuerpo: 11–13 px. Etiquetas: 7–9 px, mayúsculas, en negrita.

**Formas, tamaños y sombras:**
- Teléfono base 390×844.
- Logo: 34×34, radio 8. Buscador: alto 46, radio 10. Botón "Mi ubicación": alto 40, forma de píldora.
- Leyenda: ancho 136, radio 10, fondo `card` al 94 % con desenfoque.
- Barra inferior: flotante, alto 58, radio 18, margen 14 px a los lados, fondo `card` al 94 %, borde fino.
- Hoja de detalle: radio superior 20, aparece deslizando hacia arriba (0,32 s); fondo oscuro detrás al 42 %.
- Tarjetas de lista y resumen: radio 9. Chips de filtro: borde fino; el activo en negro (`foreground`) con texto `card`.
- Sombras suaves y frías (tono `#0E1518` a baja opacidad).
- Marcadores de zona: con zoom menor a 10, solo un punto de color de 18 px con el puntaje adentro; desde zoom 10 (y siempre en el municipio seleccionado, que va encima) cuadrado de 10 px con borde blanco y halo, y etiqueta con nombre (9 px) y "puntaje · nivel" (7 px).
- Focos de calor: punto de 7 px `primary` con borde blanco y halo naranja; pulsan suavemente (2 s).
- Texto vertical "NARIÑO COLOMBIA" a la izquierda del mapa (Archivo 800, 10 px, espaciado amplio).
- Respetar "reducir movimiento" (`prefers-reduced-motion`, desactivar animaciones).

**Pantalla Mapa:**
- Cabecera: logo (cuadrado redondeado rojo ladrillo con llama), "Willay", subtítulo "Nariño, Colombia", chip "Actualizado hace 2 h" con punto verde.
- Buscador blanco redondeado "Buscar municipio"; botón blanco "Mi ubicación".
- Municipios como marcadores cuadrados de color con nombre y "puntaje · nivel"; focos de calor como puntos con anillo.
- Texto vertical "NARIÑO COLOMBIA" al costado.
- Leyenda flotante blanca "RIESGO 24–72 H": Bajo 0–24, Medio 25–49, Alto 50–74, Extremo 75–100, y "Foco de calor".
- Aviso al pie: "Estimación de riesgo, no predicción exacta".

**Pantalla Detalle de zona (hoja inferior):**
- Hoja arrastrable desde la manija o la cabecera: posición media (~45 % del área del mapa) y expandida (~85 %); un toque en la manija alterna entre ambas, deslizar rápido mueve una posición y deslizar hasta abajo la cierra. El contenido hace scroll solo expandida y tiene relleno inferior con `safe-area` para que la barra de navegación no tape el botón.
- Cabecera oscura con textura topográfica: "ZONA SELECCIONADA", nombre grande (ej. Samaniego), "Riesgo próximas 24–72 h", bloque de color con puntaje "67 /100" y nivel; botón cerrar.
- Cuerpo claro: "Condiciones actuales" con 4 columnas (temperatura, humedad, viento km/h, días sin lluvia); "Factores de riesgo" con barras naranjas y porcentaje (Clima seco, Focos de calor cercanos, Historial de incendios).
- Bajo "Focos de calor cercanos": "N focos a 25 km o menos · el último, hace X días" (o "hace X h" si fue hace menos de un día), con los datos de `GET /api/zones/:id` (`hotspots.count`, `hotspots.latestDetectedAt`). Si el backend no los envía, no se muestra.
- Botón ancho rojo ladrillo "Ver historial de [municipio]" con icono y flecha.
- Aviso: "Datos simulados para fines académicos. El riesgo no confirma la ocurrencia de un incendio."

**Pantalla Historial:**
- Encabezado claro: "REGISTROS {primer año}–{último año}" calculado de los registros mostrados, título "Historial", "Incendios reportados en Nariño" y una nota generada de los datos con las fuentes y sus años y los años sin registros (ej. "Fuentes: UNGRD (2019–2022) y noticias locales (2026). Sin datos de 2023–2025.").
- Chips de municipio (Todos seleccionado en negro; Pasto, Ipiales, Tumaco, La Cruz).
- Resumen en 3 columnas con icono: incendios, hectáreas, último registro.
- Lista "REGISTROS" de la más reciente a la más antigua: ícono de ubicación en bloque beige, lugar y municipio, fecha, "X ha afectadas" (o "Sin dato de hectáreas" si la fuente da 0 o nada), etiqueta de fuente. El total de hectáreas suma solo las conocidas y muestra "Sin dato" si no hay ninguna.
- Pie de atribución: «Emergencias UNGRD» (UNGRD) en datos.gov.co, con enlace a cada dataset y su licencia (2019–2022 y 2023–2024 CC BY-SA 4.0, 2025 CC BY 4.0) y los cambios que hace Willay.

**Navegación:** barra inferior flotante blanca en forma de píldora con Mapa e Historial; la pestaña activa lleva fondo gris claro.

**Componentes reutilizables (componentes de Angular):** `RiskBadge`, `ZoneMarker`, `RiskLegend`, `SearchBar`, `StatColumn`, `RiskFactorBar`, `FireEventTile`, `SourceTag`, `AppButton`, `BottomNavBar`.

**Observaciones sobre el prototipo:**
- El contorno de Nariño en el prototipo es una silueta simplificada; en la app real se dibuja con el GeoJSON de IGAC/DANE sobre Leaflet.
- El prototipo de Lovable ya es web: su CSS se reutiliza casi directo en Ionic/Angular.
- Los datos son simulados; se reemplazan con los endpoints reales.
- El mapa real necesitará un estilo oscuro compatible (tiles de OpenStreetMap con tema oscuro) para acercarse a este look.

## 9. Requisitos no funcionales

- **RNF-01** Solo móvil, mobile-first.
- **RNF-02** Funciona con datos en caché si una fuente externa falla.
- **RNF-03** Respuesta de la API razonable (< 2 s en consultas de zona).
- **RNF-04** Todo lo de la sección 4 (arquitectura y buenas prácticas).

## 10. Fases (borrador — 1 mes)

1. **Semana 1:** instalar entorno, proyecto Neon con PostGIS y `schema.sql`, cargar GeoJSON de zonas, backend Express base, ingesta Open-Meteo + FIRMS en Node. *(Los scripts de Python de la Fase 1 anterior se reescriben; el esquema SQL se conserva.)*
2. **Semana 2:** scraper histórico, `RiskScoringService`, endpoints REST.
3. **Semana 3:** app Ionic/Angular: Mapa, Detalle y Historial con el CSS del prototipo, y Leaflet.
4. **Semana 4:** APK con Capacitor, despliegue del backend, pruebas, sustentación.

## 11. Preguntas abiertas

- La fecha de un incendio de noticias es la de publicación, no la del incendio (una nota puede salir días después).
- ¿Fecha exacta de entrega/sustentación?
- ¿Cómo conseguir el GeoJSON de Nariño (IGAC/DANE)?
- ¿Angular se mantiene o se cambia a React si la curva pesa?

## 12. Bloqueos (credenciales o verificación pendiente)

| Bloqueo | Qué falta | Qué ya está hecho |
|---|---|---|
| ~~NASA FIRMS sin `MAP_KEY`~~ (resuelto) | — | `MAP_KEY` en `backend/.env`, verificada el 2026-10-04 (`mapkey_status`: 5000 transacciones / 10 min). Consulta cruda de 2 y 3 días: 0 filas en Nariño (en Colombia sí había); con 5 días, 11 focos. Parser e inserción probados con esas filas. |

## 13. Registro de cambios

- **2026-10-04 (v0.20, rama `fix/ui-sheet-history`):** focos FIRMS: ventana de 2 a **5 días** y se agrega **VIIRS NOAA-21 NRT**. El factor de focos pesa cada detección por su antigüedad (1 hasta 2 días, 0 a los 5) para que siga midiendo el riesgo de 24–72 h; umbral 3 y pesos 0,5/0,3/0,2 sin cambio. `GET /api/zones/:id` devuelve `hotspots` (conteo a 25 km y última detección) y la hoja de detalle dice hace cuánto fue. Ojo: el modo en memoria usa focos de prueba del 27–29 de septiembre, que ahora pesan 0.
- **2026-10-04 (v0.19, rama `fix/ui-sheet-history`):** tope del factor de historial de 1 a **2,8 incendios por año** (p90 de los 64 municipios con UNGRD 2019–2025 + noticias), fijo y documentado en `RiskScoringService.ts`; pesos sin cambio. Zonas en 100: 36 → 8; mediana del factor: 100 → 37. Se documenta que el historial mide incendios reportados y que los municipios grandes reportan más.
- **2026-10-04 (v0.18, rama `fix/ui-sheet-history`):** UNGRD 2023–2025: se leen también `rgre-6ak4` y `2343-nuqp` (evento `INCENDIO FORESTAL`), una fuente por dataset. Feed de la Gobernación: 8 páginas y títulos con "incendios" en plural si nombran un municipio (sin hectáreas). `npm run ingest`: 701 incendios (2019: 91, 2020: 37, 2021: 11, 2022: 38, 2023: 161, 2024: 263, 2025: 94, 2026: 6). Corregida en Neon la nota de Ancuya (2026-08-28) que guardó 1.485 ha del total departamental: queda sin dato. Atribución UNGRD/datos.gov.co con licencias en Historial. El historial del modelo satura en 36 de 64 zonas: se documenta, el modelo no cambia. Diario del Sur, HSB Noticias y CorpoNariño descartados.
- **2026-10-04 (v0.17, rama `fix/ui-sheet-history`):** app: la hoja de detalle se arrastra entre media (~45 %) y expandida (~85 %), se cierra al deslizarla hasta abajo, hace scroll expandida y deja libre el botón "Ver historial" (relleno con `safe-area`); probado en emulador Android (Pixel 7). Historial: rango de años y nota de fuentes/años sin datos calculados de los registros, "Sin dato" en vez de "0,0 ha", orden por fecha descendente. Mapa: con zoom < 10 solo punto de color con puntaje; nombres desde zoom 10 o en el municipio seleccionado. Pruebas unitarias en la app con Vitest (`npm test` en `mobile/`). Auditoría de cobertura de noticias (sección 6): el feed de la Gobernación solo tiene 55 noticias desde 2024-01; los datos de 2023–2025 están en datasets nuevos de la UNGRD (propuesta, sin aplicar). Nota: v0.16 está en la rama `feat/ml`.
- **2026-10-01 (v0.15):** factor de historial: incendios por año de la zona desde el 2019-01-01 (1 por año = 100) en vez del conteo de los últimos 730 días / 5. Pesos sin cambio (0,5 / 0,3 / 0,2). Con los datos de hoy: 46 zonas con historial > 0 (antes 4), puntajes 0–20, todas en nivel Bajo (clima húmedo y sin focos porque falta `MAP_KEY`). Se documentan las limitaciones del historial (sección 7).
- **2026-10-01 (v0.14):** `npm run db:seed` solo carga las 64 zonas; el clima, los incendios y los focos de `seedData.ts` quedan solo para el modo en memoria y las pruebas. Borrados en Neon todos los datos de prueba que había cargado el seed: 8 noticias, 7 filas `ungrd` sin enlace y 7 focos de calor.
- **2026-10-01 (v0.13):** noticias del mismo incendio: la ingesta agrupa, antes de insertar, las noticias de una zona separadas por 3 días o menos (en cadena) con las ya guardadas; queda la más antigua (fecha y enlace), el mayor número de hectáreas y los demás enlaces en `fire_event.related_urls`. Limpieza única en Neon con `npm run db:merge-news` (idempotente): 5 duplicados del cerro Aminda fusionados. Filtro de incendios forestales: palabras completas ("esquema" ya no cuenta como "quema") y se descartan los que mencionan vivienda/casa/local/bodega/establecimiento sin forestal/bosque/monte/páramo/cobertura vegetal/quema. Olaya Herrera (La Isla, 2026-09-29) era un incendio urbano de 15 viviendas: borrado.
- **2026-10-01 (v0.12):** la tabla `zone` tiene los 64 municipios de Nariño (DIVIPOLA del DANE en datos.gov.co `gdxc-w37w`: nombre, código y coordenadas de la cabecera) con `npm run db:zones` (upsert); se conservan los 12 ids anteriores. Columna `zone.aliases` para nombres alternos ("Tumaco", "Magüí Payán", "El Contadero"). El clima de los 64 llega en una sola petición a Open-Meteo. Los scrapers reconocen los 64 nombres con y sin tildes ("Nariño" suelto se toma como el departamento). `GET /api/zones` omite las zonas que aún no tienen clima en vez de fallar.
- **2026-10-01 (v0.11):** scraping de noticias: se reemplaza Diario del Sur (0 resultados) por el feed RSS del buscador de la Gobernación de Nariño. Reglas más estrictas para el municipio (evitan atribuir boletines departamentales a una zona), conteo de noticias leídas / incendios / en zonas / guardados en el log de `npm run ingest`, y duplicados por `source_url` evitados en la base (`fire_event_news_url_key`) y en memoria.
- **2026-09-30 (v0.10):** el mapa usa tiles de OpenStreetMap con filtro CSS oscuro (CARTO pasó a exigir API key). Backend: repositorios PostgreSQL/PostGIS para Neon, `npm run db:schema` y `npm run db:seed`, `DATABASE_URL` en `.env` y fallback a datos en memoria. Ingesta programada con node-cron: clima de Open-Meteo (cada hora), focos de NASA FIRMS (cada 3 h, si hay `MAP_KEY`) y scraping diario de incendios (UNGRD + Diario del Sur) respetando `robots.txt` y con límite de peticiones. El modelo de riesgo (pesos 0.5/0.3/0.2) no cambia.

- **2026-09-30 (v0.9):** el proyecto cambia de nombre: FIREMAP pasa a **Willay** (quechua/kichwa: avisar, anunciar). Se renombran la app, Android (`co.willay.app`), paquetes y documentos.
- **2026-09-30 (v0.8):** primera versión del proyecto `willay/`: backend Express + TypeScript con Clean Architecture y datos de prueba (API, riesgo ponderado y pruebas), y app Ionic + Angular con las 3 pantallas del prototipo (Mapa con Leaflet, Detalle y Historial). Falta: Neon, scraping, Open-Meteo/FIRMS, GeoJSON de Nariño y despliegue.
- **2026-09-30 (v0.7):** nuevo stack: Ionic + Angular + Capacitor, Express + TypeScript, Neon (PostGIS), Leaflet, scraping en Node. Flutter + FastAPI descartados. Se reescriben arquitectura, estructura de carpetas y fases.
- **2026-09-30 (v0.6):** se reemplazan los valores estimados por los tokens reales del CSS de Lovable (colores en hex, fuentes Archivo e IBM Plex Sans, formas y tamaños).
- **2026-09-30 (v0.5):** el estilo visual pasa a ser el prototipo de Lovable (mapa oscuro, tarjetas claras, acento rojo ladrillo). Se documentan las 3 pantallas. 
- **2026-09-30 (v0.4):** estilo visual oscuro tipo dashboard. MVP: mapa, detalle, focos de calor, historial. Extras: buscador y mi ubicación. "Cómo se calcula" queda fuera del MVP.
- **2026-09-30 (v0.3):** el tipo de fuente no importa mientras haya scraping. Se agregan fuentes candidatas (noticias locales, UNGRD en datos.gov.co, IDEAM).
- **2026-09-29 (v0.2):** se confirma Flutter + FastAPI (el profesor no impuso stack). Clean Architecture completa como requisito. Solo móvil. Scraping obligatorio; predicción = puntaje de riesgo.
- **2026-09-29 (v0.1):** borrador inicial (propuesto con Java/React; descartado).
