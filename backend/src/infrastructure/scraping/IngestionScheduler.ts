import cron from 'node-cron';

/** One ingestion task: what it is called, when it runs and what it does. */
export interface IngestionJob {
  readonly name: string;
  /** node-cron expression, Colombia time. */
  readonly schedule: string;
  /** Also run when the server starts (only for cheap, API-based jobs). */
  readonly runOnStart: boolean;
  /** Returns a short summary for the log. */
  run(): Promise<string>;
}

const TIMEZONE = 'America/Bogota';

/** A failing source never stops the API: it is logged and the last stored data keeps being served. */
export async function runJob(job: IngestionJob): Promise<boolean> {
  const startedAt = Date.now();
  try {
    const summary = await job.run();
    console.log(`[ingest:${job.name}] ${summary} (${Date.now() - startedAt} ms)`);
    return true;
  } catch (error) {
    console.error(`[ingest:${job.name}] failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export function startIngestionScheduler(jobs: readonly IngestionJob[]): void {
  for (const job of jobs) {
    cron.schedule(job.schedule, () => runJob(job), { name: job.name, timezone: TIMEZONE, noOverlap: true });
    if (job.runOnStart) void runJob(job);
  }
  console.log(`Ingestion scheduled: ${jobs.map((job) => `${job.name} (${job.schedule})`).join(', ')}`);
}
