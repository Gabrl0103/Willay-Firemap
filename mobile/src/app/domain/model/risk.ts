export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface ZoneRiskSummary {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly score: number;
  readonly level: RiskLevel;
}

export interface ZoneDetail {
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
  /** FIRMS detections within 25 km in the last 5 days. Missing on backends older than v0.20. */
  readonly hotspots?: {
    readonly count: number;
    readonly latestDetectedAt: string | null;
  };
}

export interface Hotspot {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly detectedAt: string;
}

export type FireSource = 'news' | 'ungrd';

export interface FireEvent {
  readonly id: string;
  readonly zoneId: string;
  readonly place: string;
  readonly date: string;
  /** Burned area; 0 or null when the source does not say. */
  readonly hectares: number | null;
  readonly source: FireSource;
}

export interface FireHistory {
  readonly events: FireEvent[];
  readonly summary: {
    readonly count: number;
    readonly totalHectares: number;
    readonly lastDate: string | null;
  };
}

/** One row of the 72 h forecast: the model run at the end of `baseDate` (today, tomorrow, the day after). */
export interface ForecastHorizon {
  readonly hours: 24 | 48 | 72;
  readonly baseDate: string;
  /** Probability (0-1) of a heat spot <= 25 km in the 72 h after baseDate. */
  readonly probability: number;
  readonly score: number;
  readonly level: RiskLevel;
}

export type ForecastFallbackReason =
  | 'weather_unavailable'
  | 'weather_history_incomplete'
  | 'hotspot_history_incomplete'
  | 'model_error';

/** GET /api/zones/:id/forecast. 'fallback': the model could not run; `current` is today's score. */
export type ZoneForecast =
  | {
      readonly zoneId: string;
      readonly source: 'model';
      readonly modelVersion: string;
      readonly generatedAt: string;
      readonly horizons: readonly ForecastHorizon[];
    }
  | {
      readonly zoneId: string;
      readonly source: 'fallback';
      readonly reason: ForecastFallbackReason;
      readonly generatedAt: string;
      readonly current: { readonly score: number; readonly level: RiskLevel };
    };
