import type { WeatherProvider } from '../../domain/port/DataSources.js';
import type { WeatherRepository, ZoneRepository } from '../../domain/port/Repositories.js';

/** Stores a fresh weather snapshot for every zone. Returns how many were saved. */
export class IngestWeatherUseCase {
  constructor(
    private readonly zoneRepository: ZoneRepository,
    private readonly weatherProvider: WeatherProvider,
    private readonly weatherRepository: WeatherRepository,
  ) {}

  async execute(): Promise<number> {
    const zones = await this.zoneRepository.findAll();
    if (zones.length === 0) return 0;
    const snapshots = await this.weatherProvider.fetchCurrent(zones);
    for (const snapshot of snapshots) await this.weatherRepository.save(snapshot);
    return snapshots.length;
  }
}
