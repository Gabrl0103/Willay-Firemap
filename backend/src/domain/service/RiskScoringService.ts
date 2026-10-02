import type { RiskAssessment, RiskFactors } from '../model/RiskAssessment.js';
import { levelFromScore } from '../model/RiskLevel.js';
import type { WeatherSnapshot } from '../model/WeatherSnapshot.js';

export interface RiskInput {
  readonly weather: WeatherSnapshot;
  /** Heat spots detected near the zone. */
  readonly nearbyHotspotCount: number;
  /** Average fires per year registered in the zone (whole record, see fireFrequency.ts). */
  readonly firesPerYear: number;
}

/** Weights of the final score. They must add up to 1. */
export const SCORE_WEIGHTS = { dryWeather: 0.5, nearbyHotspots: 0.3, fireHistory: 0.2 } as const;

/**
 * Fires per year that give a full history factor (100). Slightly above the 90th percentile of the
 * 64 municipalities on 2026-10-01 (6 fires in 7.75 years, 0.77 per year).
 */
export const FIRES_PER_YEAR_FOR_MAX = 1;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const toPercent = (ratio: number): number => Math.round(clamp01(ratio) * 100);

/** Pure business logic: no framework, no I/O. Risk V1 = weighted score. */
export class RiskScoringService {
  assess({ weather, nearbyHotspotCount, firesPerYear }: RiskInput): RiskAssessment {
    const temperature = (weather.temperatureC - 10) / (32 - 10);
    const dryness = (80 - weather.humidityPct) / (80 - 20);
    const wind = weather.windKmh / 40;
    const noRain = weather.daysWithoutRain / 14;

    const factors: RiskFactors = {
      dryWeather: toPercent(0.3 * temperature + 0.35 * dryness + 0.15 * wind + 0.2 * noRain),
      nearbyHotspots: toPercent(nearbyHotspotCount / 3),
      fireHistory: toPercent(firesPerYear / FIRES_PER_YEAR_FOR_MAX),
    };

    const score = Math.round(
      factors.dryWeather * SCORE_WEIGHTS.dryWeather +
        factors.nearbyHotspots * SCORE_WEIGHTS.nearbyHotspots +
        factors.fireHistory * SCORE_WEIGHTS.fireHistory,
    );

    return { zoneId: weather.zoneId, score, level: levelFromScore(score), factors };
  }
}
