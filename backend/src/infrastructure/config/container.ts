import { ZoneRiskCalculator } from '../../application/service/ZoneRiskCalculator.js';
import { GetFireHistoryUseCase } from '../../application/useCase/GetFireHistoryUseCase.js';
import { GetHotspotsUseCase } from '../../application/useCase/GetHotspotsUseCase.js';
import { GetZoneDetailUseCase } from '../../application/useCase/GetZoneDetailUseCase.js';
import { GetZonesRiskUseCase } from '../../application/useCase/GetZonesRiskUseCase.js';
import { RiskScoringService } from '../../domain/service/RiskScoringService.js';
import {
  InMemoryFireEventRepository,
  InMemoryHotspotRepository,
  InMemoryWeatherRepository,
  InMemoryZoneRepository,
} from '../persistence/InMemoryRepositories.js';
import { fireEvents, hotspots, weatherSnapshots, zones } from '../persistence/seedData.js';

export interface Container {
  readonly getZonesRisk: GetZonesRiskUseCase;
  readonly getZoneDetail: GetZoneDetailUseCase;
  readonly getFireHistory: GetFireHistoryUseCase;
  readonly getHotspots: GetHotspotsUseCase;
}

/**
 * Composition root: the only place that knows which implementation is used.
 * When Neon arrives, swap the InMemory* repositories for the PostgreSQL ones here.
 */
export function buildContainer(): Container {
  const zoneRepository = new InMemoryZoneRepository(zones);
  const weatherRepository = new InMemoryWeatherRepository(weatherSnapshots);
  const fireEventRepository = new InMemoryFireEventRepository(fireEvents);
  const hotspotRepository = new InMemoryHotspotRepository(hotspots);

  const riskCalculator = new ZoneRiskCalculator(
    weatherRepository,
    fireEventRepository,
    hotspotRepository,
    new RiskScoringService(),
  );

  return {
    getZonesRisk: new GetZonesRiskUseCase(zoneRepository, riskCalculator),
    getZoneDetail: new GetZoneDetailUseCase(zoneRepository, riskCalculator),
    getFireHistory: new GetFireHistoryUseCase(fireEventRepository, zoneRepository),
    getHotspots: new GetHotspotsUseCase(hotspotRepository),
  };
}
