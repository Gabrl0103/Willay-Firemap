import type { NewFireEvent } from '../../domain/model/FireEvent.js';
import type { FireReportSource } from '../../domain/port/DataSources.js';
import type { FireEventRepository, ZoneRepository } from '../../domain/port/Repositories.js';
import { groupSameFires, mergeSameFire } from '../../domain/service/sameFireGrouping.js';

export interface FireSourceResult {
  readonly source: string;
  /** Items the source looked at (news about fires, dataset rows). */
  readonly read: number;
  /** Items about a wildfire, in any municipality. */
  readonly wildfires: number;
  /** Events in a known zone, without repeated source URLs. */
  readonly found: number;
  /** News that were about a fire already counted (stored or in the same batch): kept as a link only. */
  readonly grouped: number;
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
        const news = events.filter((event) => event.source === 'news');
        const { inserted: newsInserted, grouped } = await this.saveNews(news);
        const inserted = newsInserted + (await this.fireEventRepository.saveMany(events.filter((e) => e.source !== 'news')));
        for (const event of news) if (event.sourceUrl) knownNewsUrls.add(event.sourceUrl);
        results.push({
          source: source.name,
          read: batch.itemsRead,
          wildfires: batch.wildfireItems,
          found: events.length,
          grouped,
          inserted,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ source: source.name, read: 0, wildfires: 0, found: 0, grouped: 0, inserted: 0, error: message });
      }
    }
    return results;
  }

  /**
   * Several articles about one fire count once: new news are grouped with each other and with the
   * stored news of the same zone (SAME_FIRE_MAX_DAYS). A group with a stored event updates that row
   * (its date, link, area); a group of new events only becomes one new row.
   */
  private async saveNews(news: readonly NewFireEvent[]): Promise<{ inserted: number; grouped: number }> {
    if (news.length === 0) return { inserted: 0, grouped: 0 };
    const stored = await this.fireEventRepository.findNewsEvents();
    const fresh = new Set(news);
    const newFires: NewFireEvent[] = [];
    let grouped = 0;
    for (const group of groupSameFires<NewFireEvent>([...stored, ...news])) {
      const freshCount = group.filter((event) => fresh.has(event)).length;
      if (freshCount === 0) continue;
      const storedIds = group.flatMap((event) => ('id' in event && typeof event.id === 'string' ? [event.id] : []));
      const [keepId, ...duplicateIds] = storedIds;
      if (keepId) {
        grouped += freshCount;
        await this.fireEventRepository.replaceSameFire(keepId, mergeSameFire(group), duplicateIds);
      } else {
        grouped += freshCount - 1;
        newFires.push(mergeSameFire(group));
      }
    }
    return { inserted: await this.fireEventRepository.saveMany(newFires), grouped };
  }
}
