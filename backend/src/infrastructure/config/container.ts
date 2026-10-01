import { ZoneRiskCalculator } from '../../application/service/ZoneRiskCalculator.js';
import { GetFireHistoryUseCase } from '../../application/useCase/GetFireHistoryUseCase.js';
import { GetHotspotsUseCase } from '../../application/useCase/GetHotspotsUseCase.js';
import { GetZoneDetailUseCase } from '../../application/useCase/GetZoneDetailUseCase.js';
import { GetZonesRiskUseCase } from '../../application/useCase/GetZonesRiskUseCase.js';
import type {
  FireEventRepository,
  HotspotRepository,
  WeatherRepository,
  ZoneRepository,
} from '../../domain/port/Repositories.js';
import { RiskScoringService } from '../../domain/service/RiskScoringService.js';
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
import { env, type Env } from './env.js';

export interface Container {
  readonly getZonesRisk: GetZonesRiskUseCase;
  readonly getZoneDetail: GetZoneDetailUseCase;
  readonly getFireHistory: GetFireHistoryUseCase;
  readonly getHotspots: GetHotspotsUseCase;
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
  };
}
