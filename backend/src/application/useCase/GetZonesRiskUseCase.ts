import type { RiskLevel } from '../../domain/model/RiskLevel.js';
import type { ZoneRepository } from '../../domain/port/Repositories.js';
import type { ZoneRiskCalculator } from '../service/ZoneRiskCalculator.js';

export interface ZoneRiskSummary {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly score: number;
  readonly level: RiskLevel;
}

export class GetZonesRiskUseCase {
  constructor(
    private readonly zoneRepository: ZoneRepository,
    private readonly riskCalculator: ZoneRiskCalculator,
  ) {}

  async execute(): Promise<ZoneRiskSummary[]> {
    const zones = await this.zoneRepository.findAll();
    const summaries = await Promise.all(
      zones.map(async (zone) => {
        const { assessment } = await this.riskCalculator.calculate(zone);
        return {
          id: zone.id,
          name: zone.name,
          latitude: zone.latitude,
          longitude: zone.longitude,
          score: assessment.score,
          level: assessment.level,
        };
      }),
    );
    return summaries.sort((a, b) => b.score - a.score);
  }
}
