import type { NewFireEvent } from '../../domain/model/FireEvent.js';
import type { FireReportSource } from '../../domain/port/DataSources.js';
import type { FireEventRepository, ZoneRepository } from '../../domain/port/Repositories.js';

export interface FireSourceResult {
  readonly source: string;
  /** Items the source looked at (news about fires, dataset rows). */
  readonly read: number;
  /** Items about a wildfire, in any municipality. */
  readonly wildfires: number;
  /** Events in a known zone, without repeated source URLs. */
  readonly found: number;
  readonly inserted: number;
  /** Set when the source failed; the other sources still run. */
  readonly error?: string;
}

/** Keeps the first event of each news page; dataset rows share one URL, so they are not filtered. */
function dropRepeatedNews(events: readonly NewFireEvent[], known: ReadonlySet<string>): NewFireEvent[] {
  const seen = new Set(known);
  return events.filter((event) => {
    if (event.source !== 'news' || !event.sourceUrl) return true;
    if (seen.has(event.sourceUrl)) return false;
    seen.add(event.sourceUrl);
    return true;
  });
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
    const knownNewsUrls = await this.fireEventRepository.findSourceUrls('news');
    const results: FireSourceResult[] = [];
    for (const source of this.sources) {
      try {
        const batch = await source.fetchReports(zones, knownNewsUrls);
        const events = dropRepeatedNews(batch.events, knownNewsUrls);
        const inserted = await this.fireEventRepository.saveMany(events);
        for (const event of events) if (event.source === 'news' && event.sourceUrl) knownNewsUrls.add(event.sourceUrl);
        results.push({
          source: source.name,
          read: batch.itemsRead,
          wildfires: batch.wildfireItems,
          found: events.length,
          inserted,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ source: source.name, read: 0, wildfires: 0, found: 0, inserted: 0, error: message });
      }
    }
    return results;
  }
}
