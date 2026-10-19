import type { OpenMeteoDay } from './RiskForecast.js';

/**
 * 'archive': Open-Meteo historical weather (ERA5, the source the Open-Meteo -> POWER map was fitted
 * on). 'forecast': the last days, which the archive only fills with forecast data (ERA5 arrives
 * ~6 days late); a later ingestion replaces them with archive values.
 */
export type DailyWeatherSource = 'archive' | 'forecast';

/** One local day of weather of a zone, stored for the 72 h forecast. */
export type DailyWeather = OpenMeteoDay & {
  readonly zoneId: string;
  readonly source: DailyWeatherSource;
};

/** Days of daily weather and VIIRS detections kept: the 30-day features plus some margin. */
export const FORECAST_HISTORY_DAYS = 35;
