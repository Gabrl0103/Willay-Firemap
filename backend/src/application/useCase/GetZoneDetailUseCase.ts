import { NotFoundError } from '../../domain/error/DomainErrors.js';
import type { RiskAssessment } from '../../domain/model/RiskAssessment.js';
import type { WeatherSnapshot } from '../../domain/model/WeatherSnapshot.js';
import type { Zone } from '../../domain/model/Zone.js';
import type { ZoneRepository } from '../../domain/port/Repositories.js';
import type { NearbyHotspots, ZoneRiskCalculator } from '../service/ZoneRiskCalculator.js';

export interface ZoneDetail {
  readonly zone: Zone;
  readonly weather: WeatherSnapshot;
  readonly assessment: RiskAssessment;
  readonly nearbyHotspots: NearbyHotspots;
}

export class GetZoneDetailUseCase {
  constructor(
    private readonly zoneRepository: ZoneRepository,
    private readonly riskCalculator: ZoneRiskCalculator,
  ) {}

  async execute(zoneId: string): Promise<ZoneDetail> {
    const zone = await this.zoneRepository.findById(zoneId);
    if (!zone) throw new NotFoundError(`Zone ${zoneId} not found`);
    const { weather, assessment, nearbyHotspots } = await this.riskCalculator.calculate(zone);
    return { zone, weather, assessment, nearbyHotspots };
  }
}
