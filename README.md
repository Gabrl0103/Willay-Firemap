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
npm run db:seed             # carga los mismos datos de prueba de seedData.ts
npm run dev                 # debe decir "Persistence: PostgreSQL (Neon)"
```

#### Ingesta de datos
Con `npm run dev` el backend programa la ingesta (node-cron, hora de Colombia) y trae el clima al arrancar.
Para correrla una vez a mano: `npm run ingest` (todas) o `npm run ingest weather` (una).

| Tarea | Fuente | Frecuencia |
|---|---|---|
| `weather` | Open-Meteo (sin API key) → `weather_snapshot` | cada hora |
| `hotspots` | NASA FIRMS, VIIRS últimos 2 días → `hotspot` (solo si hay `MAP_KEY`) | cada 3 h |
| `fires` | Scraping: dataset UNGRD (datos.gov.co `wwkg-r6te`) y noticias de Diario del Sur → `fire_event` | diario, 03:30 |

El scraping revisa `robots.txt` antes de cada URL (caché 24 h), deja al menos 5 s entre peticiones al mismo sitio (o el `Crawl-delay` si es mayor) y lee máximo 15 artículos por corrida.

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
- Crear el proyecto en Neon y poner `DATABASE_URL` en `backend/.env` (el código ya está listo).
- Pedir la `MAP_KEY` de NASA FIRMS y ponerla en `backend/.env`.
- Verificar el scraper de noticias contra Diario del Sur (`npm run ingest fires`) y ajustar sus URLs de listado.
- GeoJSON de Nariño (IGAC/DANE) para dibujar los límites.
- Desplegar el backend (Render/Railway) y cambiar `API_BASE_URL` en `mobile/src/app/core/config/api-config.ts`.
