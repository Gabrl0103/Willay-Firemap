import { env } from '../../config/env.js';

export function requireDatabaseUrl(): string {
  if (!env.databaseUrl) {
    console.error('DATABASE_URL is missing. Copy .env.example to .env and paste the Neon connection string.');
    process.exit(1);
  }
  return env.databaseUrl;
}
