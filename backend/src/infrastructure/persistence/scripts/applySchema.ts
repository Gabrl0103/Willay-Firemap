import { readFile } from 'node:fs/promises';
import { closePool, getPool } from '../postgresPool.js';
import { requireDatabaseUrl } from './requireDatabaseUrl.js';

/** npm run db:schema — runs database/schema.sql (idempotent: CREATE ... IF NOT EXISTS). */
const schemaFile = new URL('../../../../../database/schema.sql', import.meta.url);

const pool = getPool(requireDatabaseUrl());
try {
  await pool.query(await readFile(schemaFile, 'utf8'));
  console.log('Schema applied.');
} finally {
  await closePool();
}
