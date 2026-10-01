import { PostgresFireEventRepository, PostgresHotspotRepository } from '../PostgresRepositories.js';
import { closePool, getPool } from '../postgresPool.js';
import { fireEvents, hotspots, weatherSnapshots, zones } from '../seedData.js';
import { requireDatabaseUrl } from './requireDatabaseUrl.js';

/**
 * npm run db:seed — loads the same test data as seedData.ts. Safe to run again:
 * zones are upserted, and weather/hotspots are only added where there is no real data yet.
 */
const pool = getPool(requireDatabaseUrl());
try {
  for (const zone of zones) {
    await pool.query(
      `INSERT INTO zone (id, name, centroid)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, centroid = EXCLUDED.centroid`,
      [zone.id, zone.name, zone.latitude, zone.longitude],
    );
  }

  for (const w of weatherSnapshots) {
    await pool.query(
      `INSERT INTO weather_snapshot (zone_id, temperature_c, humidity_pct, wind_kmh, days_without_rain)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (SELECT 1 FROM weather_snapshot WHERE zone_id = $1)`,
      [w.zoneId, w.temperatureC, w.humidityPct, w.windKmh, w.daysWithoutRain],
    );
  }

  const insertedFires = await new PostgresFireEventRepository(pool).saveMany(fireEvents);

  const { rows } = await pool.query<{ count: string }>('SELECT count(*) FROM hotspot');
  const seedHotspots = rows[0]?.count === '0';
  if (seedHotspots) await new PostgresHotspotRepository(pool).replaceAll(hotspots);

  console.log(
    `Seed done: ${zones.length} zones, ${insertedFires} new fire events, ` +
      `hotspots ${seedHotspots ? 'added' : 'kept (table not empty)'}.`,
  );
} finally {
  await closePool();
}
