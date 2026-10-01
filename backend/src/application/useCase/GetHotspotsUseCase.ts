import type { Hotspot } from '../../domain/model/Hotspot.js';
import type { HotspotRepository } from '../../domain/port/Repositories.js';

export class GetHotspotsUseCase {
  constructor(private readonly hotspotRepository: HotspotRepository) {}

  execute(): Promise<Hotspot[]> {
    return this.hotspotRepository.findAll();
  }
}
