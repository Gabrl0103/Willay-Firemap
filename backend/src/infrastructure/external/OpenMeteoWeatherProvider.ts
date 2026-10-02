import axios from 'axios';
import type { WeatherSnapshot } from '../../domain/model/WeatherSnapshot.js';
import type { Zone } from '../../domain/model/Zone.js';
import type { WeatherProvider } from '../../domain/port/DataSources.js';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
/** Days looked back to count "days without rain" (the risk model saturates at 14). */
const PAST_DAYS = 14;
/** Less than this in a day still counts as a dry day. */
const RAIN_THRESHOLD_MM = 1;

export interface OpenMeteoLocation {
  readonly current?: {
    readonly temperature_2m: number;
    readonly relative_humidity_2m: number;
    readonly wind_speed_10m: number;
  };
  readonly daily?: { readonly precipitation_sum: ReadonlyArray<number | null> };
}

/** Consecutive dry days counted back from the most recent day. */
export function daysWithoutRain(dailyPrecipitationMm: ReadonlyArray<number | null>): number {
  let days = 0;
  for (let i = dailyPrecipitationMm.length - 1; i >= 0; i--) {
    if ((dailyPrecipitationMm[i] ?? 0) >= RAIN_THRESHOLD_MM) break;
    days++;
  }
  return days;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function toWeatherSnapshot(zoneId: string, location: OpenMeteoLocation): WeatherSnapshot {
  if (!location.current || !location.daily) {
    throw new Error(`Open-Meteo returned no current/daily data for zone ${zoneId}`);
  }
  return {
    zoneId,
    temperatureC: round1(location.current.temperature_2m),
    humidityPct: Math.round(location.current.relative_humidity_2m),
    windKmh: round1(location.current.wind_speed_10m),
    daysWithoutRain: daysWithoutRain(location.daily.precipitation_sum),
  };
}

/**
 * Open-Meteo (free, no API key). One request for all zones (64 municipalities): the API accepts
 * lists of coordinates and answers one location per pair, in the same order.
 */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  async fetchCurrent(zones: readonly Zone[]): Promise<WeatherSnapshot[]> {
    if (zones.length === 0) return [];
    const { data } = await axios.get<OpenMeteoLocation | OpenMeteoLocation[]>(OPEN_METEO_URL, {
      timeout: 30_000, // 64 locations with 14 past days take longer than one
      params: {
        latitude: zones.map((zone) => zone.latitude).join(','),
        longitude: zones.map((zone) => zone.longitude).join(','),
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
        daily: 'precipitation_sum',
        past_days: PAST_DAYS,
        forecast_days: 1,
        wind_speed_unit: 'kmh',
        timezone: 'America/Bogota',
      },
    });
    // One location -> object; several -> array in the same order as the coordinates.
    const locations = Array.isArray(data) ? data : [data];
    if (locations.length !== zones.length) {
      throw new Error(`Open-Meteo returned ${locations.length} locations for ${zones.length} zones`);
    }
    return zones.map((zone, index) => toWeatherSnapshot(zone.id, locations[index] ?? {}));
  }
}
