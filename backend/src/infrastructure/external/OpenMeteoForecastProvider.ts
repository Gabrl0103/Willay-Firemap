import axios from 'axios';
import type { OpenMeteoDay } from '../../domain/model/RiskForecast.js';
import type { Zone } from '../../domain/model/Zone.js';
import type { WeatherForecastProvider } from '../../domain/port/DataSources.js';
import { asLocations, dailyParams, toOpenMeteoDays, type OpenMeteoDailyLocation } from './OpenMeteoArchiveProvider.js';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
/** Open-Meteo updates its models every few hours: one call per zone and hour is enough. */
const CACHE_MS = 60 * 60 * 1000;

/** Open-Meteo forecast (free, no API key), daily values for the coming days of one zone. */
export class OpenMeteoForecastProvider implements WeatherForecastProvider {
  private readonly cache = new Map<string, { readonly at: number; readonly days: OpenMeteoDay[] }>();

  constructor(private readonly now: () => number = Date.now) {}

  async fetchForecast(zone: Zone, from: string, to: string): Promise<OpenMeteoDay[]> {
    const key = `${zone.id}|${from}|${to}`;
    const cached = this.cache.get(key);
    if (cached && this.now() - cached.at < CACHE_MS) return cached.days;

    const { data } = await axios.get<OpenMeteoDailyLocation | OpenMeteoDailyLocation[]>(OPEN_METEO_FORECAST_URL, {
      timeout: 15_000,
      params: { ...dailyParams([zone]), start_date: from, end_date: to },
    });
    const [location] = asLocations(data, 1);
    const days = toOpenMeteoDays(location ?? {});
    for (const [cachedKey, entry] of this.cache) if (this.now() - entry.at >= CACHE_MS) this.cache.delete(cachedKey);
    this.cache.set(key, { at: this.now(), days });
    return days;
  }
}
