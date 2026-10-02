import { NARINO_MUNICIPALITIES } from '../narinoMunicipalities.js';
import { closePool, getPool } from '../postgresPool.js';
import { upsertZones } from '../upsertZones.js';
import { requireDatabaseUrl } from './requireDatabaseUrl.js';

/** npm run db:zones — loads the 64 municipalities of Nariño (DIVIPOLA, DANE) into `zone`. Safe to run again. */
const pool = getPool(requireDatabaseUrl());
try {
  const written = await upsertZones(pool, NARINO_MUNICIPALITIES);
  const { rows } = await pool.query<{ total: number; with_code: number }>(
    'SELECT count(*)::int AS total, count(divipola)::int AS with_code FROM zone',
  );
  console.log(`Zones upserted: ${written}. Table zone now has ${rows[0]?.total} zones (${rows[0]?.with_code} with DIVIPOLA code).`);
} finally {
  await closePool();
}
