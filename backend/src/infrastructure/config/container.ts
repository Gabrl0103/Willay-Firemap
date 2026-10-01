import { ZoneRiskCalculator } from '../../application/service/ZoneRiskCalculator.js';
import { GetFireHistoryUseCase } from '../../application/useCase/GetFireHistoryUseCase.js';
import { GetHotspotsUseCase } from '../../application/useCase/GetHotspotsUseCase.js';
import { GetZoneDetailUseCase } from '../../application/useCase/GetZoneDetailUseCase.js';
import { GetZonesRiskUseCase } from '../../application/useCase/GetZonesRiskUseCase.js';
import { IngestFireEventsUseCase } from '../../application/useCase/IngestFireEventsUseCase.js';
import { IngestHotspotsUseCase } from '../../application/useCase/IngestHotspotsUseCase.js';
import { IngestWeatherUseCase } from '../../application/useCase/IngestWeatherUseCase.js';
import type {
  FireEventRepository,
  HotspotRepository,
  WeatherRepository,
  ZoneRepository,
} from '../../domain/port/Repositories.js';
import { RiskScoringService } from '../../domain/service/RiskScoringService.js';
import { FirmsHotspotProvider } from '../external/FirmsHotspotProvider.js';
import { OpenMeteoWeatherProvider } from '../external/OpenMeteoWeatherProvider.js';
import {
  InMemoryFireEventRepository,
  InMemoryHotspotRepository,
  InMemoryWeatherRepository,
  InMemoryZoneRepository,
} from '../persistence/InMemoryRepositories.js';
import {
  PostgresFireEventRepository,
  PostgresHotspotRepository,
  PostgresWeatherRepository,
  PostgresZoneRepository,
} from '../persistence/PostgresRepositories.js';
import { getPool } from '../persistence/postgresPool.js';
import { fireEvents, hotspots, weatherSnapshots, zones } from '../persistence/seedData.js';
import { createFireReportSources } from '../scraping/FireReportSourceFactory.js';
import type { IngestionJob } from '../scraping/IngestionScheduler.js';
import { env, type Env } from './env.js';

export interface Container {
  readonly getZonesRisk: GetZonesRiskUseCase;
  readonly getZoneDetail: GetZoneDetailUseCase;
  readonly getFireHistory: GetFireHistoryUseCase;
  readonly getHotspots: GetHotspotsUseCase;
  /** Scheduled by the server (node-cron) and runnable once with `npm run ingest`. */
  readonly ingestionJobs: readonly IngestionJob[];
}

interface RepositorySet {
  readonly zones: ZoneRepository;
  readonly weather: WeatherRepository;
  readonly fireEvents: FireEventRepository;
  readonly hotspots: HotspotRepository;
}

/** Neon when DATABASE_URL exists; otherwise the in-memory test data (handy for local work and tests). */
function buildRepositories(config: Env): RepositorySet {
  if (config.databaseUrl) {
    const pool = getPool(config.databaseUrl);
    console.log('Persistence: PostgreSQL (Neon)');
    return {
      zones: new PostgresZoneRepository(pool),
      weather: new PostgresWeatherRepository(pool),
      fireEvents: new PostgresFireEventRepository(pool),
      hotspots: new PostgresHotspotRepository(pool),
    };
  }
  console.log('Persistence: in-memory test data (DATABASE_URL is not set)');
  return {
    zones: new InMemoryZoneRepository(zones),
    weather: new InMemoryWeatherRepository(weatherSnapshots),
    fireEvents: new InMemoryFireEventRepository(fireEvents),
    hotspots: new InMemoryHotspotRepository(hotspots),
  };
}

/** Composition root: the only place that knows which implementation is used. */
export function buildContainer(config: Env = env): Container {
  const repositories = buildRepositories(config);

  const riskCalculator = new ZoneRiskCalculator(
    repositories.weather,
    repositories.fireEvents,
    repositories.hotspots,
    new RiskScoringService(),
  );

  return {
    getZonesRisk: new GetZonesRiskUseCase(repositories.zones, riskCalculator),
    getZoneDetail: new GetZoneDetailUseCase(repositories.zones, riskCalculator),
    getFireHistory: new GetFireHistoryUseCase(repositories.fireEvents, repositories.zones),
    getHotspots: new GetHotspotsUseCase(repositories.hotspots),
    ingestionJobs: buildIngestionJobs(repositories, config),
  };
}

function buildIngestionJobs(repositories: RepositorySet, config: Env): IngestionJob[] {
  const ingestWeather = new IngestWeatherUseCase(repositories.zones, new OpenMeteoWeatherProvider(), repositories.weather);

  const jobs: IngestionJob[] = [
    {
      name: 'weather',
      schedule: '0 * * * *', // every hour
      runOnStart: true,
      run: async () => `${await ingestWeather.execute()} weather snapshots saved`,
    },
  ];

  if (config.firmsMapKey) {
    const ingestHotspots = new IngestHotspotsUseCase(new FirmsHotspotProvider(config.firmsMapKey), repositories.hotspots);
    jobs.push({
      name: 'hotspots',
      schedule: '15 */3 * * *', // every 3 hours
      runOnStart: true,
      run: async () => `${await ingestHotspots.execute()} hotspots stored`,
    });
  } else {
    console.log('Hotspots: MAP_KEY is not set, NASA FIRMS ingestion is off');
  }

  const ingestFires = new IngestFireEventsUseCase(repositories.zones, createFireReportSources(), repositories.fireEvents);
  jobs.push({
    name: 'fires',
    schedule: '30 3 * * *', // once a day, at night: scraping is slow on purpose
    runOnStart: false,
    run: async () => {
      const results = await ingestFires.execute();
      if (results.every((result) => result.error)) {
        throw new Error(results.map((result) => `${result.source}: ${result.error}`).join('; '));
      }
      return results
        .map((r) => (r.error ? `${r.source}: failed (${r.error})` : `${r.source}: ${r.found} found, ${r.inserted} new`))
        .join('; ');
    },
  });

  return jobs;
}
