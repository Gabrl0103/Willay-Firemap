import { buildContainer } from '../config/container.js';
import { closePool } from '../persistence/postgresPool.js';
import { runJob } from './IngestionScheduler.js';

/** npm run ingest [job ...] — runs the ingestion jobs once (all of them, or the named ones). */
const requested = process.argv.slice(2);
const { ingestionJobs } = buildContainer();
const jobs = requested.length > 0 ? ingestionJobs.filter((job) => requested.includes(job.name)) : ingestionJobs;

if (jobs.length === 0) {
  console.error(`No job matches. Available: ${ingestionJobs.map((job) => job.name).join(', ')}`);
  process.exitCode = 1;
}
let failed = false;
for (const job of jobs) {
  if (!(await runJob(job))) failed = true;
}
if (failed) process.exitCode = 1;
await closePool();
