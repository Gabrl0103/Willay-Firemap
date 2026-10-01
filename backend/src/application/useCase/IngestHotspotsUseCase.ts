import type { HotspotProvider } from '../../domain/port/DataSources.js';
import type { HotspotRepository } from '../../domain/port/Repositories.js';

/** Replaces the stored hotspots with the latest detections. Returns how many there are. */
export class IngestHotspotsUseCase {
  constructor(
    private readonly hotspotProvider: HotspotProvider,
    private readonly hotspotRepository: HotspotRepository,
  ) {}

  async execute(): Promise<number> {
    const hotspots = await this.hotspotProvider.fetchRecent();
    await this.hotspotRepository.replaceAll(hotspots);
    return hotspots.length;
  }
}
