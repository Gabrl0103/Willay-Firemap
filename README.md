# Willay

App móvil que muestra el riesgo de incendio forestal por municipio en Nariño, Colombia.

- `backend/` — API en Express + TypeScript (Clean Architecture). Usa Neon si hay `DATABASE_URL`; si no, **datos de prueba** en memoria.
- `mobile/` — App Ionic + Angular + Capacitor (Android).
- `database/` — `schema.sql` para Neon (PostGIS).
- `docs/` — `REQUIREMENTS.md` (requisitos y decisiones).

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
Sin `DATABASE_URL` el backend usa los datos de prueba en memoria. Para usar Neon:
```
cd backend
copy .env.example .env      # pega la cadena de conexión de Neon en DATABASE_URL
npm run db:schema           # crea PostGIS y las tablas (database/schema.sql)
npm run db:zones            # carga los 64 municipios de Nariño (DIVIPOLA del DANE)
npm run db:seed             # opcional: clima, incendios y focos de prueba
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

El scraping revisa `robots.txt` antes de cada URL (caché 24 h), deja al menos 5 s entre peticiones al mismo sitio (o el `Crawl-delay` si es mayor) y no vuelve a guardar una noticia ya guardada (`source_url`).

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

## Endpoints
- `GET /api/zones` — municipios con puntaje y nivel de riesgo.
- `GET /api/zones/:id` — detalle: clima y factores.
- `GET /api/fires?zoneId=pasto` — historial de incendios y resumen.
- `GET /api/hotspots` — focos de calor.

## Qué falta
- Pedir la `MAP_KEY` de NASA FIRMS y ponerla en `backend/.env`.
- Varias noticias sobre el mismo incendio cuentan como eventos distintos (p. ej. cerro Aminda).
- Polígonos de los municipios (GeoJSON IGAC/DANE) para dibujar los límites.
- Desplegar el backend (Render/Railway) y cambiar `API_BASE_URL` en `mobile/src/app/core/config/api-config.ts`.
