import type { RiskLevel } from './RiskLevel.js';

/** Open-Meteo daily variables the forecast model reads (native units: mm, °C, %, km/h at 10 m). */
export const OPEN_METEO_DAILY_VARIABLES = [
  'precipitation_sum',
  'temperature_2m_mean',
  'temperature_2m_max',
  'temperature_2m_min',
  'relative_humidity_2m_mean',
  'wind_speed_10m_max',
  'wind_speed_10m_mean',
  'et0_fao_evapotranspiration',
] as const;

export type OpenMeteoDailyVariable = (typeof OPEN_METEO_DAILY_VARIABLES)[number];

/** One local day (America/Bogota) of Open-Meteo weather. null = the API had no value. */
export type OpenMeteoDay = { readonly date: string } & Readonly<Record<OpenMeteoDailyVariable, number | null>>;

/** Open-Meteo value -> the NASA POWER value the model was trained on: slope * x + intercept, clipped. */
export interface WeatherMapRule {
  readonly openMeteo: OpenMeteoDailyVariable;
  readonly slope: number;
  readonly intercept: number;
  readonly min: number | null;
  readonly max: number | null;
}

/** NASA POWER daily columns the weather features use (ml/willay_ml/power.py). */
export type PowerDailyColumn =
  | 'precipitation_mm'
  | 'temperature_mean_c'
  | 'temperature_max_c'
  | 'temperature_min_c'
  | 'humidity_mean_pct'
  | 'wind_max_ms'
  | 'wind_mean_ms'
  | 'evapotranspiration_mm';

/** The exported logistic regression (backend/src/infrastructure/ml/risk-model-*.json). */
export interface RiskModelParams {
  readonly version: string;
  readonly features: readonly string[];
  readonly logFeatures: readonly string[];
  readonly mean: readonly number[];
  readonly scale: readonly number[];
  readonly coefficients: readonly number[];
  readonly intercept: number;
  readonly platt: { readonly slope: number; readonly intercept: number };
  readonly weather: {
    readonly dryDayMm: number;
    readonly openMeteoToPower: Readonly<Record<PowerDailyColumn, WeatherMapRule>>;
    readonly surfaceSoilWetness: number;
  };
  readonly hotspots: {
    readonly radiusKm: number;
    readonly ringRadiusKm: number;
    /** FIRMS sources the model counts (the training used SNPP + NOAA-20 only). */
    readonly sources: readonly string[];
    readonly localUtcOffsetHours: number;
    readonly staticSourceKm: number;
    /** [latitude, longitude] of volcanoes and other static sources FIRMS flags. */
    readonly staticSources: ReadonlyArray<readonly number[]>;
  };
  /** Days per year with a hotspot <= radiusKm in 2015-2018, per zone id. */
  readonly zoneHotspotDaysPerYear: Readonly<Record<string, number>>;
}

/** Feature name -> value, in any order (predictRisk reads them in params.features order). */
export type RiskFeatures = Readonly<Record<string, number>>;

export interface RiskPrediction {
  /** Probability (0-1) of at least one hotspot <= 25 km in the next 72 h. */
  readonly probability: number;
  /** probability * 100, rounded: the same 0-100 scale as the current score. */
  readonly score: number;
  readonly level: RiskLevel;
}

export type ForecastHours = 24 | 48 | 72;

export interface ForecastHorizon extends RiskPrediction {
  readonly hours: ForecastHours;
  /** Local day at whose end the model is run (today, tomorrow, the day after). */
  readonly baseDate: string;
}

export type ForecastFallbackReason =
  | 'weather_unavailable'
  | 'weather_history_incomplete'
  | 'hotspot_history_incomplete'
  | 'model_error';

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
      /** The current weighted score, so the app still has something real to show. */
      readonly current: { readonly score: number; readonly level: RiskLevel };
    };
