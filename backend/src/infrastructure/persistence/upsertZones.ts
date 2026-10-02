import type pg from 'pg';
import type { Municipality } from './narinoMunicipalities.js';

/**
 * Inserts or updates the zones by id in one statement (idempotent). Zones not in the list are
 * left alone, and so are their weather and fire events. Returns how many rows were written.
 */
export async function upsertZones(pool: pg.Pool, municipalities: readonly Municipality[]): Promise<number> {
  const result = await pool.query(
    `INSERT INTO zone (id, name, divipola, centroid, aliases)
     SELECT id, name, divipola, ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
            string_to_array(aliases, '|')
     FROM unnest($1::text[], $2::text[], $3::int[], $4::float8[], $5::float8[], $6::text[])
          AS m(id, name, divipola, latitude, longitude, aliases)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       divipola = EXCLUDED.divipola,
       centroid = EXCLUDED.centroid,
       aliases = EXCLUDED.aliases`,
    [
      municipalities.map((m) => m.id),
      municipalities.map((m) => m.name),
      municipalities.map((m) => m.divipola),
      municipalities.map((m) => m.latitude),
      municipalities.map((m) => m.longitude),
      // '|' never appears in a name; string_to_array('', '|') gives an empty array.
      municipalities.map((m) => m.aliases.join('|')),
    ],
  );
  return result.rowCount ?? 0;
}
