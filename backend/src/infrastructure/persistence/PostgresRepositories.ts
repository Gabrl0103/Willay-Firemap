import type pg from 'pg';
import type { FireEvent, FireSource, NewFireEvent } from '../../domain/model/FireEvent.js';
import type { Hotspot, NewHotspot } from '../../domain/model/Hotspot.js';
import type { WeatherSnapshot } from '../../domain/model/WeatherSnapshot.js';
import type { Zone } from '../../domain/model/Zone.js';
import type {
  FireEventRepository,
  HotspotRepository,
  WeatherRepository,
  ZoneRepository,
} from '../../domain/port/Repositories.js';

/** Repositories over Neon (PostgreSQL + PostGIS). Table definitions: database/schema.sql. */

interface ZoneRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  aliases: string[];
}

const SELECT_ZONE = `
  SELECT id, name, ST_Y(centroid::geometry) AS latitude, ST_X(centroid::geometry) AS longitude, aliases
  FROM zone`;

export class PostgresZoneRepository implements ZoneRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findAll(): Promise<Zone[]> {
    const { rows } = await this.pool.query<ZoneRow>(`${SELECT_ZONE} ORDER BY name`);
    return rows;
  }

  async findById(id: string): Promise<Zone | undefined> {
    const { rows } = await this.pool.query<ZoneRow>(`${SELECT_ZONE} WHERE id = $1`, [id]);
    return rows[0];
  }
}

interface WeatherRow {
  zone_id: string;
  temperature_c: number;
  humidity_pct: number;
  wind_kmh: number;
  days_without_rain: number;
}

export class PostgresWeatherRepository implements WeatherRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findByZoneId(zoneId: string): Promise<WeatherSnapshot | undefined> {
    const { rows } = await this.pool.query<WeatherRow>(
      `SELECT zone_id, temperature_c, humidity_pct, wind_kmh, days_without_rain
       FROM weather_snapshot WHERE zone_id = $1
       ORDER BY captured_at DESC LIMIT 1`,
      [zoneId],
    );
    const row = rows[0];
    return row && {
      zoneId: row.zone_id,
      temperatureC: row.temperature_c,
      humidityPct: row.humidity_pct,
      windKmh: row.wind_kmh,
      daysWithoutRain: row.days_without_rain,
    };
  }

  async save(snapshot: WeatherSnapshot): Promise<void> {
    await this.pool.query(
      `INSERT INTO weather_snapshot (zone_id, temperature_c, humidity_pct, wind_kmh, days_without_rain)
       VALUES ($1, $2, $3, $4, $5)`,
      [snapshot.zoneId, snapshot.temperatureC, snapshot.humidityPct, snapshot.windKmh, snapshot.daysWithoutRain],
    );
  }
}

interface FireEventRow {
  id: string;
  zone_id: string;
  place: string;
  date: string;
  hectares: number;
  source: FireSource;
}

export class PostgresFireEventRepository implements FireEventRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findAll(): Promise<FireEvent[]> {
    // to_char keeps the DATE as text: pg would turn it into a Date in the server's time zone.
    const { rows } = await this.pool.query<FireEventRow>(
      `SELECT id::text AS id, zone_id, place, to_char(event_date, 'YYYY-MM-DD') AS date, hectares, source
       FROM fire_event ORDER BY event_date DESC`,
    );
    return rows.map((row) => ({
      id: row.id,
      zoneId: row.zone_id,
      place: row.place,
      date: row.date,
      hectares: row.hectares,
      source: row.source,
    }));
  }

  async saveMany(events: readonly NewFireEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const result = await this.pool.query(
      `INSERT INTO fire_event (zone_id, place, event_date, hectares, source, source_url)
       SELECT * FROM unnest($1::text[], $2::text[], $3::date[], $4::real[], $5::text[], $6::text[])
       ON CONFLICT DO NOTHING`, // same (zone_id, place, event_date), or a news source_url already stored
      [
        events.map((e) => e.zoneId),
        events.map((e) => e.place),
        events.map((e) => e.date),
        events.map((e) => e.hectares),
        events.map((e) => e.source),
        events.map((e) => e.sourceUrl ?? null),
      ],
    );
    return result.rowCount ?? 0;
  }

  async findSourceUrls(source: FireSource): Promise<Set<string>> {
    const { rows } = await this.pool.query<{ source_url: string }>(
      'SELECT DISTINCT source_url FROM fire_event WHERE source = $1 AND source_url IS NOT NULL',
      [source],
    );
    return new Set(rows.map((row) => row.source_url));
  }
}

interface HotspotRow {
  id: string;
  latitude: number;
  longitude: number;
  detected_at: string;
}

export class PostgresHotspotRepository implements HotspotRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findAll(): Promise<Hotspot[]> {
    const { rows } = await this.pool.query<HotspotRow>(
      `SELECT id::text AS id,
              ST_Y(location::geometry) AS latitude,
              ST_X(location::geometry) AS longitude,
              to_char(detected_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS detected_at
       FROM hotspot ORDER BY detected_at DESC`,
    );
    return rows.map((row) => ({
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      detectedAt: row.detected_at,
    }));
  }

  async replaceAll(hotspots: readonly NewHotspot[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM hotspot');
      await client.query(
        `INSERT INTO hotspot (location, detected_at)
         SELECT ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, detected_at
         FROM unnest($1::float8[], $2::float8[], $3::timestamptz[]) AS h(lat, lon, detected_at)`,
        [hotspots.map((h) => h.latitude), hotspots.map((h) => h.longitude), hotspots.map((h) => h.detectedAt)],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
