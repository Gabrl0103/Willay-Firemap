import type { ZoneDetail } from '../../application/useCase/GetZoneDetailUseCase.js';
import type { RiskLevel } from '../../domain/model/RiskLevel.js';

/** Shape of GET /api/zones/:id (the contract with the mobile app). */
export interface ZoneDetailDto {
  readonly id: string;
  readonly name: string;
  readonly score: number;
  readonly level: RiskLevel;
  readonly weather: {
    readonly temperatureC: number;
    readonly humidityPct: number;
    readonly windKmh: number;
    readonly daysWithoutRain: number;
  };
  readonly factors: {
    readonly dryWeather: number;
    readonly nearbyHotspots: number;
    readonly fireHistory: number;
  };
}

export function toZoneDetailDto({ zone, weather, assessment }: ZoneDetail): ZoneDetailDto {
  return {
    id: zone.id,
    name: zone.name,
    score: assessment.score,
    level: assessment.level,
    weather: {
      temperatureC: weather.temperatureC,
      humidityPct: weather.humidityPct,
      windKmh: weather.windKmh,
      daysWithoutRain: weather.daysWithoutRain,
    },
    factors: assessment.factors,
  };
}
