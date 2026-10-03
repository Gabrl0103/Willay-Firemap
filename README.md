# Willay

App móvil que muestra el riesgo de incendio forestal por municipio en Nariño, Colombia.

- `backend/` — API en Express + TypeScript (Clean Architecture). Usa Neon si hay `DATABASE_URL`; si no, **datos de prueba** en memoria.
- `mobile/` — App Ionic + Angular + Capacitor (Android).
- `database/` — `schema.sql` para Neon (PostGIS).
- `ml/` — Machine learning en Python: datos históricos (NASA FIRMS, NASA POWER), variables, entrenamiento y evaluación. Ver `ml/README.md`.
- `docs/` — `REQUIREMENTS.md` (requisitos y decisiones) y `ML.md` (modelo de machine learning).

## Cómo correrlo (Windows)

Necesitas Node.js 24 (o el LTS que ya tienes), Git y Android Studio.

### 1. Backend
```
cd backend
npm install
npm run dev
```
Debe decir `Willay API listening on http://localhost:3000/api`.
Pruébalo en el navegador: http://localhost:3000/api/zones

Pruebas del cálculo de riesgo: `npm test`.

#### Base de datos (Neon)
Sin `DATABASE_URL` el backend usa los datos de prueba en memoria (`seedData.ts`); esos datos nunca se escriben en Neon. Para usar Neon:
```
cd backend
copy .env.example .env      # pega la cadena de conexión de Neon en DATABASE_URL
npm run db:schema           # crea PostGIS y las tablas (database/schema.sql)
npm run db:zones            # carga los 64 municipios de Nariño (DIVIPOLA del DANE)
npm run db:seed             # opcional: igual que db:zones (no carga datos de prueba)
npm run dev                 # debe decir "Persistence: PostgreSQL (Neon)"
```

`npm run db:zones` se puede correr las veces que quieras (upsert por `id`). Los datos están en
`backend/src/infrastructure/persistence/narinoMunicipalities.ts`: nombre, código DIVIPOLA y coordenadas
de la cabecera municipal tal como los publica el DANE (datos.gov.co, dataset `gdxc-w37w`), más alias
("Tumaco", "Magüí Payán") para reconocer el municipio en noticias y en el dataset de la UNGRD.
Los 12 ids originales (`pasto`, `ipiales`, `tumaco`…) se conservan.

#### Ingesta de datos
Con `npm run dev` el backend programa la ingesta (node-cron, hora de Colombia) y trae el clima al arrancar.
Para correrla una vez a mano: `npm run ingest` (todas) o `npm run ingest weather` (una).

| Tarea | Fuente | Frecuencia |
|---|---|---|
| `weather` | Open-Meteo (sin API key), una sola petición para los 64 municipios → `weather_snapshot` | cada hora |
| `hotspots` | NASA FIRMS, VIIRS últimos 2 días → `hotspot` (solo si hay `MAP_KEY`) | cada 3 h |
| `fires` | Scraping: dataset UNGRD (datos.gov.co `wwkg-r6te`) y feed RSS de noticias de la Gobernación de Nariño → `fire_event` | diario, 03:30 |

El scraping revisa `robots.txt` antes de cada URL (caché 24 h), deja al menos 5 s entre peticiones al mismo sitio (o el `Crawl-delay` si es mayor) y no vuelve a guardar una noticia ya guardada (`source_url`). Las noticias de un mismo municipio con 3 días o menos entre una y otra cuentan como **un solo incendio**: se guarda la más antigua y las demás quedan como enlaces de referencia (`related_urls`).

### 2. App en el navegador
En otra terminal:
```
cd mobile
npm install
npm start
```
Abre http://localhost:4200 (con el backend encendido).

### 3. App en el emulador de Android
```
cd mobile
npm install
npx cap add android        # solo la primera vez
npm run build:android
npm run open:android       # abre Android Studio; pulsa Run con un emulador
```
El emulador llega al backend de tu PC por `10.0.2.2:3000` (ya está configurado).
Para generar el APK: Android Studio → Build → Build APK(s).

## Modelo de riesgo
Puntaje 0–100 por municipio = **0,5 × clima seco + 0,3 × focos cercanos + 0,2 × historial** (cada factor de 0 a 100).
- **Clima seco:** temperatura, humedad, viento y días sin lluvia de Open-Meteo.
- **Focos cercanos:** focos de NASA FIRMS a 25 km o menos (3 o más = 100).
- **Historial:** incendios por año del municipio desde el 2019-01-01 (UNGRD + noticias); 1 incendio por año = 100.

Niveles: Bajo 0–24, Medio 25–49, Alto 50–74, Extremo 75–100. Detalle y limitaciones en `docs/REQUIREMENTS.md` (sección 7).

### Modelo de machine learning (en evaluación)
En `ml/` hay un modelo que estima la probabilidad de focos de calor a ≤ 25 km en las próximas 72 h. Se entrenó con NASA FIRMS (VIIRS) y clima de NASA POWER. En el periodo de prueba (2025–2026), la regresión logística supera al modelo de pesos: ROC-AUC 0,85 frente a 0,68. Aún **no está integrado en el backend**. Resultados y limitaciones en `docs/ML.md`; cómo reproducirlo en `ml/README.md`.

## Endpoints
- `GET /api/zones` — municipios con puntaje y nivel de riesgo.
- `GET /api/zones/:id` — detalle: clima y factores.
- `GET /api/fires?zoneId=pasto` — historial de incendios y resumen.
- `GET /api/hotspots` — focos de calor.

## Qué falta
- Pedir la `MAP_KEY` de NASA FIRMS y ponerla en `backend/.env`.
- Polígonos de los municipios (GeoJSON IGAC/DANE) para dibujar los límites.
- Desplegar el backend (Render/Railway) y cambiar `API_BASE_URL` en `mobile/src/app/core/config/api-config.ts`.
