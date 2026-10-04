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
