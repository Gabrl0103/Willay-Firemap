import { FORECAST_HISTORY_DAYS } from '../../domain/model/DailyWeather.js';
import type { NewHotspot } from '../../domain/model/Hotspot.js';
import type { HotspotProvider } from '../../domain/port/DataSources.js';
import type { HotspotDetectionRepository, HotspotRepository } from '../../domain/port/Repositories.js';
import { addDays } from '../../domain/service/forecastFeatures.js';
import { dedupeAcrossSatellites } from '../../domain/service/hotspotDedup.js';
import { HOTSPOT_WINDOW_DAYS } from '../../domain/service/hotspotRecency.js';

export interface HotspotIngestResult {
  /** Detections the satellites reported. */
  readonly detected: number;
  /** Hotspots stored after removing the same fire seen by several satellites. */
  readonly stored: number;
}

/** UTC days the FIRMS window (HOTSPOT_WINDOW_DAYS up to today) covers completely: all but today. */
export function completeUtcDays(now: Date, windowDays: number = HOTSPOT_WINDOW_DAYS): string[] {
  const today = now.toISOString().slice(0, 10);
  return Array.from({ length: windowDays - 1 }, (_, i) => addDays(today, i - (windowDays - 1)));
}

/**
 * Replaces the stored hotspots with the latest detections, one per fire (map and current score),
 * and keeps the raw detections of every satellite for the ML forecast (30 days).
 */
export class IngestHotspotsUseCase {
  constructor(
    private readonly hotspotProvider: HotspotProvider,
    private readonly hotspotRepository: HotspotRepository,
    private readonly detectionRepository: HotspotDetectionRepository,
  ) {}

  async execute(now: Date = new Date()): Promise<HotspotIngestResult> {
    const detections = await this.hotspotProvider.fetchRecent();
    const hotspots: NewHotspot[] = dedupeAcrossSatellites(detections).map(({ latitude, longitude, detectedAt }) => ({
      latitude,
      longitude,
      detectedAt,
    }));
    await this.hotspotRepository.replaceAll(hotspots);
    await this.detectionRepository.saveFetch(
      detections.map(({ source, latitude, longitude, detectedAt }) => ({ source, latitude, longitude, detectedAt })),
      completeUtcDays(now),
      addDays(now.toISOString().slice(0, 10), -FORECAST_HISTORY_DAYS),
    );
    return { detected: detections.length, stored: hotspots.length };
  }
}
