import type { FireReportSource } from '../../domain/port/DataSources.js';
import type { FireEventRepository, ZoneRepository } from '../../domain/port/Repositories.js';

export interface FireSourceResult {
  readonly source: string;
  readonly found: number;
  readonly inserted: number;
  /** Set when the source failed; the other sources still run. */
  readonly error?: string;
}

/** Collects fire events from every source and stores the new ones. */
export class IngestFireEventsUseCase {
  constructor(
    private readonly zoneRepository: ZoneRepository,
    private readonly sources: readonly FireReportSource[],
    private readonly fireEventRepository: FireEventRepository,
  ) {}

  async execute(): Promise<FireSourceResult[]> {
    const zones = await this.zoneRepository.findAll();
    const results: FireSourceResult[] = [];
    for (const source of this.sources) {
      try {
        const events = await source.fetchReports(zones);
        const inserted = await this.fireEventRepository.saveMany(events);
        results.push({ source: source.name, found: events.length, inserted });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ source: source.name, found: 0, inserted: 0, error: message });
      }
    }
    return results;
  }
}
