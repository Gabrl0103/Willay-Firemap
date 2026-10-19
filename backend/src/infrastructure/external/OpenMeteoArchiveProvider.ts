import axios from 'axios';
import { LOCAL_UTC_OFFSET_HOURS } from '../../application/useCase/IngestDailyWeatherUseCase.js';
import type { DailyWeather } from '../../domain/model/DailyWeather.js';
import { OPEN_METEO_DAILY_VARIABLES, type OpenMeteoDay } from '../../domain/model/RiskForecast.js';
import type { Zone } from '../../domain/model/Zone.js';
import type { DailyWeatherProvider } from '../../domain/port/DataSources.js';
import { addDays, localDate } from '../../domain/service/forecastFeatures.js';

const OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
/** ERA5 reaches the archive ~6 days late; newer days are filled with forecast data (ml/willay_ml/weather.py). */
export const ARCHIVE_DELAY_DAYS = 6;
/** Locations per request, as the ML download did (keeps each call light for the free plan). */
const ZONES_PER_REQUEST = 16;

/** Open-Meteo answer for one location with `daily=` (one array per variable, same order as `time`). */
export interface OpenMeteoDailyLocation {
  readonly daily?: { readonly time: readonly string[] } & Partial<
    Record<(typeof OPEN_METEO_DAILY_VARIABLES)[number], ReadonlyArray<number | null>>
  >;
}

/** One location's daily arrays -> one OpenMeteoDay per date (null when a value is missing). */
export function toOpenMeteoDays(location: OpenMeteoDailyLocation): OpenMeteoDay[] {
  const daily = location.daily;
  if (!daily) throw new Error('Open-Meteo returned no daily data');
  return daily.time.map((date, i) => {
    const day: Record<string, string | number | null> = { date };
    for (const variable of OPEN_METEO_DAILY_VARIABLES) day[variable] = daily[variable]?.[i] ?? null;
    return day as OpenMeteoDay;
  });
}

/** Common query of the daily calls (archive and forecast APIs take the same names and units). */
export function dailyParams(zones: readonly Zone[]): Record<string, string> {
  return {
    latitude: zones.map((zone) => zone.latitude).join(','),
    longitude: zones.map((zone) => zone.longitude).join(','),
    daily: OPEN_METEO_DAILY_VARIABLES.join(','),
    wind_speed_unit: 'kmh',
    timezone: 'America/Bogota',
  };
}

/** One location -> object; several -> array in the same order as the coordinates. */
export function asLocations<T>(data: T | T[], expected: number): T[] {
  const locations = Array.isArray(data) ? data : [data];
  if (locations.length !== expected) {
    throw new Error(`Open-Meteo returned ${locations.length} locations for ${expected} zones`);
  }
  return locations;
}

/**
 * Open-Meteo historical weather (free, no API key): the source the Open-Meteo -> NASA POWER map of
 * the ML model was fitted on. Days newer than ARCHIVE_DELAY_DAYS are marked 'forecast'.
 */
export class OpenMeteoArchiveProvider implements DailyWeatherProvider {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async fetchDaily(zones: readonly Zone[], from: string, to: string): Promise<DailyWeather[]> {
    const archiveUntil = addDays(localDate(this.now().toISOString(), LOCAL_UTC_OFFSET_HOURS), -ARCHIVE_DELAY_DAYS);
    const result: DailyWeather[] = [];
    for (let start = 0; start < zones.length; start += ZONES_PER_REQUEST) {
      const batch = zones.slice(start, start + ZONES_PER_REQUEST);
      const { data } = await axios.get<OpenMeteoDailyLocation | OpenMeteoDailyLocation[]>(OPEN_METEO_ARCHIVE_URL, {
        timeout: 60_000,
        params: { ...dailyParams(batch), start_date: from, end_date: to },
      });
      asLocations(data, batch.length).forEach((location, index) => {
        const zoneId = batch[index]?.id;
        if (!zoneId) return;
        for (const day of toOpenMeteoDays(location)) {
          result.push({ ...day, zoneId, source: day.date <= archiveUntil ? 'archive' : 'forecast' });
        }
      });
    }
    return result;
  }
}
