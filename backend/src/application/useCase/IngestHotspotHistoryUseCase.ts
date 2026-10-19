import { FORECAST_HISTORY_DAYS } from '../../domain/model/DailyWeather.js';
import type { HotspotHistoryProvider } from '../../domain/port/DataSources.js';
import type { HotspotDetectionRepository } from '../../domain/port/Repositories.js';
import { addDays } from '../../domain/service/forecastFeatures.js';

/** FIRMS returns at most 5 days per request. */
const DAYS_PER_REQUEST = 5;

/**
 * Loads the raw VIIRS detections of the last FORECAST_HISTORY_DAYS UTC days (up to yesterday) in
 * 5-day requests, and marks those days as complete. Used once for the initial history and then
 * daily, so days missed while the server slept are filled in. Returns how many detections came.
 */
export class IngestHotspotHistoryUseCase {
  constructor(
    private readonly historyProvider: HotspotHistoryProvider,
    private readonly detectionRepository: HotspotDetectionRepository,
  ) {}

  async execute(now: Date = new Date()): Promise<number> {
    const today = now.toISOString().slice(0, 10);
    const firstDay = addDays(today, -FORECAST_HISTORY_DAYS);
    let detected = 0;
    for (let offset = 0; offset < FORECAST_HISTORY_DAYS; offset += DAYS_PER_REQUEST) {
      const start = addDays(firstDay, offset);
      const days = Math.min(DAYS_PER_REQUEST, FORECAST_HISTORY_DAYS - offset);
      const detections = await this.historyProvider.fetchDays(start, days);
      const complete = Array.from({ length: days }, (_, i) => addDays(start, i));
      await this.detectionRepository.saveFetch(
        detections.map(({ source, latitude, longitude, detectedAt }) => ({ source, latitude, longitude, detectedAt })),
        complete,
        firstDay,
      );
      detected += detections.length;
    }
    return detected;
  }
}
