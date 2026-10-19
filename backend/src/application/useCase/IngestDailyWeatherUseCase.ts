import { FORECAST_HISTORY_DAYS } from '../../domain/model/DailyWeather.js';
import type { DailyWeatherProvider } from '../../domain/port/DataSources.js';
import type { DailyWeatherRepository, ZoneRepository } from '../../domain/port/Repositories.js';
import { addDays, localDate } from '../../domain/service/forecastFeatures.js';

/** Colombia (UTC-5, no daylight saving time): the days of the forecast are local days. */
export const LOCAL_UTC_OFFSET_HOURS = -5;

/**
 * Stores the daily weather of every zone for the last FORECAST_HISTORY_DAYS local days up to
 * yesterday (today is still changing: the forecast endpoint asks for it). Also used once to load
 * the initial history. Returns how many zone-days were saved.
 */
export class IngestDailyWeatherUseCase {
  constructor(
    private readonly zoneRepository: ZoneRepository,
    private readonly weatherProvider: DailyWeatherProvider,
    private readonly dailyWeatherRepository: DailyWeatherRepository,
  ) {}

  async execute(now: Date = new Date()): Promise<number> {
    const zones = await this.zoneRepository.findAll();
    if (zones.length === 0) return 0;
    const today = localDate(now.toISOString(), LOCAL_UTC_OFFSET_HOURS);
    const from = addDays(today, -FORECAST_HISTORY_DAYS);
    const days = await this.weatherProvider.fetchDaily(zones, from, addDays(today, -1));
    await this.dailyWeatherRepository.upsertMany(days, from);
    return days.length;
  }
}
