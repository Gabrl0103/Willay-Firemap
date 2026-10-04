import type { NewHotspot } from '../../domain/model/Hotspot.js';
import type { HotspotProvider } from '../../domain/port/DataSources.js';
import type { HotspotRepository } from '../../domain/port/Repositories.js';
import { dedupeAcrossSatellites } from '../../domain/service/hotspotDedup.js';

export interface HotspotIngestResult {
  /** Detections the satellites reported. */
  readonly detected: number;
  /** Hotspots stored after removing the same fire seen by several satellites. */
  readonly stored: number;
}

/** Replaces the stored hotspots with the latest detections, one per fire. */
export class IngestHotspotsUseCase {
  constructor(
    private readonly hotspotProvider: HotspotProvider,
    private readonly hotspotRepository: HotspotRepository,
  ) {}

  async execute(): Promise<HotspotIngestResult> {
    const detections = await this.hotspotProvider.fetchRecent();
    const hotspots: NewHotspot[] = dedupeAcrossSatellites(detections).map(({ latitude, longitude, detectedAt }) => ({
      latitude,
      longitude,
      detectedAt,
    }));
    await this.hotspotRepository.replaceAll(hotspots);
    return { detected: detections.length, stored: hotspots.length };
  }
}
