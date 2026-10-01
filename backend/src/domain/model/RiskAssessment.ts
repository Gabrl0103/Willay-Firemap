import type { RiskLevel } from './RiskLevel.js';

/** Each factor goes from 0 to 100. */
export interface RiskFactors {
  readonly dryWeather: number;
  readonly nearbyHotspots: number;
  readonly fireHistory: number;
}

export interface RiskAssessment {
  readonly zoneId: string;
  readonly score: number;
  readonly level: RiskLevel;
  readonly factors: RiskFactors;
}
