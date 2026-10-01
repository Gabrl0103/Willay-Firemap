/** Typed access to the environment. Reads backend/.env when it exists (Node >= 20.12). */
try {
  process.loadEnvFile();
} catch {
  // No .env file: use the real environment only.
}

const optional = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

export interface Env {
  readonly port: number;
  /** Neon/PostgreSQL connection string. Without it the API uses the in-memory test data. */
  readonly databaseUrl?: string;
  /** NASA FIRMS MAP_KEY. Without it hotspots are not ingested. */
  readonly firmsMapKey?: string;
  /** Scheduled ingestion (cron). Set INGESTION_ENABLED=false to turn it off. */
  readonly ingestionEnabled: boolean;
}

export const env: Env = {
  port: Number(optional('PORT') ?? 3000),
  databaseUrl: optional('DATABASE_URL'),
  firmsMapKey: optional('MAP_KEY'),
  ingestionEnabled: optional('INGESTION_ENABLED') !== 'false',
};
