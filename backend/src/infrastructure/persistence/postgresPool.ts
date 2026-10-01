import pg from 'pg';

let pool: pg.Pool | undefined;

/** Singleton: one connection pool per process. Neon needs SSL (sslmode=require in the URL). */
export function getPool(connectionString: string): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
    // Neon closes idle connections when the compute sleeps; without this listener the process would crash.
    pool.on('error', (error) => console.error('PostgreSQL idle client error:', error.message));
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
