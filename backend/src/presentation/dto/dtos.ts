import type { ZoneDetail } from '../../application/useCase/GetZoneDetailUseCase.js';
import type { ForecastFallbackReason, ForecastHours, ZoneForecast } from '../../domain/model/RiskForecast.js';
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
  /** NASA FIRMS detections within 25 km in the last 5 days, and when the newest one was seen. */
  readonly hotspots: {
    readonly count: number;
    readonly latestDetectedAt: string | null;
  };
}

export function toZoneDetailDto({ zone, weather, assessment, nearbyHotspots }: ZoneDetail): ZoneDetailDto {
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
    hotspots: { count: nearbyHotspots.count, latestDetectedAt: nearbyHotspots.latestDetectedAt },
  };
}

/** Shape of GET /api/zones/:id/forecast. `source: 'fallback'` = the model could not run (see `reason`). */
export type ZoneForecastDto =
  | {
      readonly zoneId: string;
      readonly source: 'model';
      readonly modelVersion: string;
      readonly generatedAt: string;
      readonly horizons: ReadonlyArray<{
        readonly hours: ForecastHours;
        readonly baseDate: string;
        /** Probability (0-1, 3 decimals) of a hotspot <= 25 km in the 72 h after baseDate. */
        readonly probability: number;
        readonly score: number;
        readonly level: RiskLevel;
      }>;
    }
  | {
      readonly zoneId: string;
      readonly source: 'fallback';
      readonly reason: ForecastFallbackReason;
      readonly generatedAt: string;
      readonly current: { readonly score: number; readonly level: RiskLevel };
    };

export function toZoneForecastDto(forecast: ZoneForecast): ZoneForecastDto {
  if (forecast.source === 'fallback') return forecast;
  return {
    ...forecast,
    horizons: forecast.horizons.map(({ hours, baseDate, probability, score, level }) => ({
      hours,
      baseDate,
      probability: Math.round(probability * 1000) / 1000,
      score,
      level,
    })),
  };
}
