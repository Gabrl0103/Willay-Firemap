import { groupSameFires, mergeSameFire } from '../../../domain/service/sameFireGrouping.js';
import { PostgresFireEventRepository } from '../PostgresRepositories.js';
import { closePool, getPool } from '../postgresPool.js';
import { requireDatabaseUrl } from './requireDatabaseUrl.js';

/**
 * npm run db:merge-news — one-off cleanup (2026-10-01) of the news stored before the ingestion
 * grouped articles about the same fire. Safe to run again: it finds nothing the second time.
 * 1. Deletes news reviewed by hand that are not wildfires.
 * 2. Merges the news of a zone at most 3 days apart into one event (the oldest), like the ingestion.
 */
const NOT_WILDFIRES = [
  // Olaya Herrera, sector La Isla: 15 houses burned in the town of Bocas de Satinga (urban fire).
  // It passed the old filter because "esquema" contains "quema".
  'https://narino.gov.co/dependencias/gestion-del-riesgo-de-desastre/narino-responde-llego-a-olaya-herrera-para-atender-a-familias-afectadas-por-incendio-y-avanzar-en-su-recuperacion/',
];

const pool = getPool(requireDatabaseUrl());
const repository = new PostgresFireEventRepository(pool);
try {
  const deleted = await pool.query("DELETE FROM fire_event WHERE source = 'news' AND source_url = ANY($1::text[])", [
    NOT_WILDFIRES,
  ]);

  const stored = await repository.findNewsEvents();
  let merged = 0;
  for (const group of groupSameFires(stored)) {
    const [keep, ...duplicates] = group;
    if (!keep || duplicates.length === 0) continue;
    await repository.replaceSameFire(keep.id, mergeSameFire(group), duplicates.map((event) => event.id));
    merged += duplicates.length;
  }
  console.log(
    `News cleanup: ${deleted.rowCount ?? 0} non-wildfire deleted, ${merged} duplicates merged ` +
      `(${stored.length} -> ${stored.length - merged} news events).`,
  );
} finally {
  await closePool();
}
