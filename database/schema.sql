-- Willay: esquema para Neon (PostgreSQL + PostGIS).
-- Todavía NO lo usa el backend (hoy trabaja con datos de prueba en memoria).
-- Se ejecuta en el SQL Editor de Neon cuando pasemos a la base real.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Municipios (o veredas). El polígono sale del GeoJSON de IGAC/DANE.
CREATE TABLE IF NOT EXISTS zone (
  id         TEXT PRIMARY KEY,                 -- ej. 'pasto'
  name       TEXT NOT NULL,
  divipola   INTEGER UNIQUE,                   -- código DANE del municipio
  centroid   GEOGRAPHY(Point, 4326) NOT NULL,
  boundary   GEOGRAPHY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS zone_boundary_gix ON zone USING GIST (boundary);

-- Clima más reciente por zona (Open-Meteo).
CREATE TABLE IF NOT EXISTS weather_snapshot (
  id                BIGSERIAL PRIMARY KEY,
  zone_id           TEXT NOT NULL REFERENCES zone(id),
  temperature_c     REAL NOT NULL,
  humidity_pct      REAL NOT NULL,
  wind_kmh          REAL NOT NULL,
  days_without_rain INTEGER NOT NULL,
  captured_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weather_zone_time_idx ON weather_snapshot (zone_id, captured_at DESC);

-- Incendios históricos (scraping de noticias + datos abiertos UNGRD).
CREATE TABLE IF NOT EXISTS fire_event (
  id         BIGSERIAL PRIMARY KEY,
  zone_id    TEXT NOT NULL REFERENCES zone(id),
  place      TEXT NOT NULL,
  event_date DATE NOT NULL,
  hectares   REAL NOT NULL DEFAULT 0,
  source     TEXT NOT NULL CHECK (source IN ('news', 'ungrd')),
  source_url TEXT,
  UNIQUE (zone_id, place, event_date)          -- evita duplicados al volver a scrapear
);
CREATE INDEX IF NOT EXISTS fire_event_zone_date_idx ON fire_event (zone_id, event_date DESC);

-- Focos de calor (NASA FIRMS).
CREATE TABLE IF NOT EXISTS hotspot (
  id          BIGSERIAL PRIMARY KEY,
  location    GEOGRAPHY(Point, 4326) NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS hotspot_location_gix ON hotspot USING GIST (location);
