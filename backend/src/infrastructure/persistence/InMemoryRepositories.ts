import type { FireEvent, FireSource, NewFireEvent, StoredFireEvent } from '../../domain/model/FireEvent.js';
import type { Hotspot, NewHotspot } from '../../domain/model/Hotspot.js';
import type { WeatherSnapshot } from '../../domain/model/WeatherSnapshot.js';
import type { Zone } from '../../domain/model/Zone.js';
import type {
  FireEventRepository,
  HotspotRepository,
  WeatherRepository,
  ZoneRepository,
} from '../../domain/port/Repositories.js';

export class InMemoryZoneRepository implements ZoneRepository {
  constructor(private readonly zones: readonly Zone[]) {}
  async findAll(): Promise<Zone[]> {
    return [...this.zones];
  }
  async findById(id: string): Promise<Zone | undefined> {
    return this.zones.find((zone) => zone.id === id);
  }
}

export class InMemoryWeatherRepository implements WeatherRepository {
  private readonly snapshots = new Map<string, WeatherSnapshot>();
  constructor(initial: readonly WeatherSnapshot[]) {
    for (const snapshot of initial) this.snapshots.set(snapshot.zoneId, snapshot);
  }
  async findByZoneId(zoneId: string): Promise<WeatherSnapshot | undefined> {
    return this.snapshots.get(zoneId);
  }
  async save(snapshot: WeatherSnapshot): Promise<void> {
    this.snapshots.set(snapshot.zoneId, snapshot);
  }
}

const fireKey = (event: NewFireEvent): string => `${event.zoneId}|${event.place}|${event.date}`;

export class InMemoryFireEventRepository implements FireEventRepository {
  /** Stored with their links; findAll strips them (the API does not serve them). */
  private events: StoredFireEvent[];
  private nextId: number;
  constructor(initial: readonly FireEvent[]) {
    this.events = [...initial];
    this.nextId = initial.length + 1;
  }
  async findAll(): Promise<FireEvent[]> {
    return this.events.map(({ sourceUrl: _sourceUrl, relatedUrls: _relatedUrls, ...event }) => event);
  }
  async saveMany(events: readonly NewFireEvent[]): Promise<number> {
    const known = new Set(this.events.map(fireKey));
    const newsUrls = await this.findSourceUrls('news');
    let inserted = 0;
    for (const event of events) {
      const isKnownNews = event.source === 'news' && !!event.sourceUrl && newsUrls.has(event.sourceUrl);
      if (known.has(fireKey(event)) || isKnownNews) continue;
      known.add(fireKey(event));
      if (event.source === 'news' && event.sourceUrl) newsUrls.add(event.sourceUrl);
      this.events.push({ ...event, id: `mem-${this.nextId++}` });
      inserted++;
    }
    return inserted;
  }
  async findSourceUrls(source: FireSource): Promise<Set<string>> {
    const urls = this.events
      .filter((event) => event.source === source)
      .flatMap((event) => [event.sourceUrl, ...(event.relatedUrls ?? [])]);
    return new Set(urls.filter((url): url is string => !!url));
  }
  async findNewsEvents(): Promise<StoredFireEvent[]> {
    return this.events.filter((event) => event.source === 'news');
  }
  async replaceSameFire(keepId: string, fire: NewFireEvent, duplicateIds: readonly string[]): Promise<void> {
    this.events = this.events
      .filter((event) => !duplicateIds.includes(event.id))
      .map((event) => (event.id === keepId ? { ...fire, id: keepId } : event));
  }
}

export class InMemoryHotspotRepository implements HotspotRepository {
  private hotspots: Hotspot[];
  constructor(initial: readonly Hotspot[]) {
    this.hotspots = [...initial];
  }
  async findAll(): Promise<Hotspot[]> {
    return [...this.hotspots];
  }
  async replaceAll(hotspots: readonly NewHotspot[]): Promise<void> {
    this.hotspots = hotspots.map((hotspot, index) => ({ ...hotspot, id: `mem-${index + 1}` }));
  }
}
