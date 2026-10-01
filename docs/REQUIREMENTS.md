# Willay — Requisitos y decisiones

*(Antes llamado FIREMAP. **Willay** viene del quechua/kichwa: "avisar, contar, anunciar" — la app avisa dónde hay riesgo de incendio. Confirmar el significado y la escritura con un hablante o una fuente local.)*

> Documento vivo. Se actualiza al cierre de cada sesión. Al iniciar una sesión nueva, pega este archivo (o léelo del proyecto) para retomar el contexto.
> **Última actualización:** 2026-09-30 · **Versión:** 0.10 (Neon e ingesta de datos)

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
| Noticias locales: Diario del Sur, HSB Noticias | Incendios recientes (2023–hoy): fecha, lugar, a veces hectáreas | Pendiente: revisar `robots.txt` de cada sitio antes de scrapear. Diario del Sur bloquea acceso automático en la prueba hecha; si lo prohíbe, se usa HSB u otra. |
| Datos abiertos UNGRD: "Emergencias UNGRD" (datos.gov.co, CC BY-SA 4.0) | Histórico 2019–2022 con municipio, DIVIPOLA, evento y hectáreas | Verificado: hay registros de Nariño con incendios de cobertura vegetal. Última actualización en 2023. |
| IDEAM: puntos de calor y estadísticas de incendios | Focos y estadísticas | Candidato, sin verificar si hay datos descargables. |

**APIs abiertas (tiempo real):** NASA FIRMS (focos de calor), Open-Meteo (clima, sin API key).

**Límites de zonas:** GeoJSON de municipios/veredas de Nariño (IGAC o DANE). *Bloqueante actual: sin esto no se puebla la tabla de zonas.*

**Notas:**
- Las noticias hay que procesarlas: extraer texto, detectar municipio/lugar y guardarlo como evento histórico.
- Falta confirmar con el profesor que las noticias y los datos abiertos cuentan como scraping válido.

## 7. Modelo de riesgo

- **V1:** puntaje ponderado por zona (0–100) → nivel Bajo / Medio / Alto / Extremo.
- **Variables:** temperatura, humedad, viento, días sin lluvia (Open-Meteo); focos FIRMS cercanos; frecuencia histórica (scraping).
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
- Marcadores de zona: cuadrado de 10 px con borde blanco y halo del mismo color; etiqueta con nombre (9 px) y "puntaje · nivel" (7 px).
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
- Cabecera oscura con textura topográfica: "ZONA SELECCIONADA", nombre grande (ej. Samaniego), "Riesgo próximas 24–72 h", bloque de color con puntaje "67 /100" y nivel; botón cerrar.
- Cuerpo claro: "Condiciones actuales" con 4 columnas (temperatura, humedad, viento km/h, días sin lluvia); "Factores de riesgo" con barras naranjas y porcentaje (Clima seco, Focos de calor cercanos, Historial de incendios).
- Botón ancho rojo ladrillo "Ver historial de [municipio]" con icono y flecha.
- Aviso: "Datos simulados para fines académicos. El riesgo no confirma la ocurrencia de un incendio."

**Pantalla Historial:**
- Encabezado claro: "REGISTROS 2023–2026", título "Historial", "Incendios reportados en Nariño".
- Chips de municipio (Todos seleccionado en negro; Pasto, Ipiales, Tumaco, La Cruz).
- Resumen en 3 columnas con icono: incendios, hectáreas, último registro.
- Lista "REGISTROS": ícono de ubicación en bloque beige, lugar y municipio, fecha, "X ha afectadas", etiqueta de fuente.

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

- ¿Qué sitio de noticias permite scraping según su `robots.txt`? (Diario del Sur bloqueó la prueba; probar HSB Noticias)
- ¿Fecha exacta de entrega/sustentación?
- ¿Cómo conseguir el GeoJSON de Nariño (IGAC/DANE)?
- ¿Angular se mantiene o se cambia a React si la curva pesa?

## 12. Bloqueos (credenciales o verificación pendiente)

| Bloqueo | Qué falta | Qué ya está hecho |
|---|---|---|
| **Neon sin credenciales** | No hay `backend/.env` con `DATABASE_URL`, así que `database/schema.sql` y el seed **no se han ejecutado** en Neon, y el SQL de los repositorios no se ha probado contra una base real. Pasos: crear el proyecto en Neon, pegar la cadena en `backend/.env` y correr `npm run db:schema` y `npm run db:seed`. | Repositorios PostgreSQL/PostGIS (`infrastructure/persistence/PostgresRepositories.ts`), scripts de esquema y seed, y `container.ts` con fallback a memoria si no hay `DATABASE_URL`. |

## 13. Registro de cambios

- **2026-09-30 (v0.10):** el mapa usa tiles de OpenStreetMap con filtro CSS oscuro (CARTO pasó a exigir API key). Backend: repositorios PostgreSQL/PostGIS para Neon, `npm run db:schema` y `npm run db:seed`, `DATABASE_URL` en `.env` y fallback a datos en memoria.

- **2026-09-30 (v0.9):** el proyecto cambia de nombre: FIREMAP pasa a **Willay** (quechua/kichwa: avisar, anunciar). Se renombran la app, Android (`co.willay.app`), paquetes y documentos.
- **2026-09-30 (v0.8):** primera versión del proyecto `willay/`: backend Express + TypeScript con Clean Architecture y datos de prueba (API, riesgo ponderado y pruebas), y app Ionic + Angular con las 3 pantallas del prototipo (Mapa con Leaflet, Detalle y Historial). Falta: Neon, scraping, Open-Meteo/FIRMS, GeoJSON de Nariño y despliegue.
- **2026-09-30 (v0.7):** nuevo stack: Ionic + Angular + Capacitor, Express + TypeScript, Neon (PostGIS), Leaflet, scraping en Node. Flutter + FastAPI descartados. Se reescriben arquitectura, estructura de carpetas y fases.
- **2026-09-30 (v0.6):** se reemplazan los valores estimados por los tokens reales del CSS de Lovable (colores en hex, fuentes Archivo e IBM Plex Sans, formas y tamaños).
- **2026-09-30 (v0.5):** el estilo visual pasa a ser el prototipo de Lovable (mapa oscuro, tarjetas claras, acento rojo ladrillo). Se documentan las 3 pantallas. 
- **2026-09-30 (v0.4):** estilo visual oscuro tipo dashboard. MVP: mapa, detalle, focos de calor, historial. Extras: buscador y mi ubicación. "Cómo se calcula" queda fuera del MVP.
- **2026-09-30 (v0.3):** el tipo de fuente no importa mientras haya scraping. Se agregan fuentes candidatas (noticias locales, UNGRD en datos.gov.co, IDEAM).
- **2026-09-29 (v0.2):** se confirma Flutter + FastAPI (el profesor no impuso stack). Clean Architecture completa como requisito. Solo móvil. Scraping obligatorio; predicción = puntaje de riesgo.
- **2026-09-29 (v0.1):** borrador inicial (propuesto con Java/React; descartado).
