import type { RiskAssessment, RiskFactors } from '../model/RiskAssessment.js';
import { levelFromScore } from '../model/RiskLevel.js';
import type { WeatherSnapshot } from '../model/WeatherSnapshot.js';

export interface RiskInput {
  readonly weather: WeatherSnapshot;
  /** Heat spots detected near the zone. */
  readonly nearbyHotspotCount: number;
  /** Fires registered in the zone in the recent past. */
  readonly recentFireCount: number;
}

/** Weights of the final score. They must add up to 1. */
export const SCORE_WEIGHTS = { dryWeather: 0.5, nearbyHotspots: 0.3, fireHistory: 0.2 } as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const toPercent = (ratio: number): number => Math.round(clamp01(ratio) * 100);

/** Pure business logic: no framework, no I/O. Risk V1 = weighted score. */
export class RiskScoringService {
  assess({ weather, nearbyHotspotCount, recentFireCount }: RiskInput): RiskAssessment {
    const temperature = (weather.temperatureC - 10) / (32 - 10);
    const dryness = (80 - weather.humidityPct) / (80 - 20);
    const wind = weather.windKmh / 40;
    const noRain = weather.daysWithoutRain / 14;

    const factors: RiskFactors = {
      dryWeather: toPercent(0.3 * temperature + 0.35 * dryness + 0.15 * wind + 0.2 * noRain),
      nearbyHotspots: toPercent(nearbyHotspotCount / 3),
      fireHistory: toPercent(recentFireCount / 5),
    };

    const score = Math.round(
      factors.dryWeather * SCORE_WEIGHTS.dryWeather +
        factors.nearbyHotspots * SCORE_WEIGHTS.nearbyHotspots +
        factors.fireHistory * SCORE_WEIGHTS.fireHistory,
    );

    return { zoneId: weather.zoneId, score, level: levelFromScore(score), factors };
  }
}
