import { NotFoundError } from '../../domain/error/DomainErrors.js';
import type { RiskFactors } from '../../domain/model/RiskAssessment.js';
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
  /**
   * What the score is made of, so the app opens the zone sheet without waiting for GET /zones/:id.
   * Optional in the contract: backends before v0.28 do not send it.
   */
  readonly factors?: RiskFactors;
}

export class GetZonesRiskUseCase {
  constructor(
    private readonly zoneRepository: ZoneRepository,
    private readonly riskCalculator: ZoneRiskCalculator,
  ) {}

  /** Zones without weather yet (a new municipality before the first ingestion) are left out, not an error. */
  async execute(): Promise<ZoneRiskSummary[]> {
    const zones = await this.zoneRepository.findAll();
    const summaries = await Promise.all(
      zones.map(async (zone): Promise<ZoneRiskSummary | undefined> => {
        let assessment;
        try {
          ({ assessment } = await this.riskCalculator.calculate(zone));
        } catch (error) {
          if (error instanceof NotFoundError) return undefined;
          throw error;
        }
        return {
          id: zone.id,
          name: zone.name,
          latitude: zone.latitude,
          longitude: zone.longitude,
          score: assessment.score,
          level: assessment.level,
          factors: assessment.factors,
        };
      }),
    );
    return summaries.filter((summary) => summary !== undefined).sort((a, b) => b.score - a.score);
  }
}
