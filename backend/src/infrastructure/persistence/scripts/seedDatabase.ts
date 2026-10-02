import { NARINO_MUNICIPALITIES } from '../narinoMunicipalities.js';
import { closePool, getPool } from '../postgresPool.js';
import { upsertZones } from '../upsertZones.js';
import { requireDatabaseUrl } from './requireDatabaseUrl.js';

/**
 * npm run db:seed — loads only the zones (the 64 municipalities, same as `npm run db:zones`).
 * Weather, fires and hotspots in the database come only from the ingestion: the test values of
 * seedData.ts are for the in-memory mode (no DATABASE_URL) and are never written here.
 * Safe to run again: zones are upserted by id.
 */
const pool = getPool(requireDatabaseUrl());
try {
  const written = await upsertZones(pool, NARINO_MUNICIPALITIES);
  console.log(`Seed done: ${written} zones upserted (no test weather, fires or hotspots).`);
} finally {
  await closePool();
}
