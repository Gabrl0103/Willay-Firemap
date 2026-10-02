import type { FireEvent, FireSource, NewFireEvent } from '../../domain/model/FireEvent.js';
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
  private readonly events: FireEvent[];
  /** "source|url" of the stored events; the domain FireEvent does not carry the URL. */
  private readonly sourceUrls = new Set<string>();
  private nextId: number;
  constructor(initial: readonly FireEvent[]) {
    this.events = [...initial];
    this.nextId = initial.length + 1;
  }
  async findAll(): Promise<FireEvent[]> {
    return [...this.events];
  }
  async saveMany(events: readonly NewFireEvent[]): Promise<number> {
    const known = new Set(this.events.map(fireKey));
    let inserted = 0;
    for (const { sourceUrl, ...event } of events) {
      const key = fireKey(event);
      const urlKey = event.source === 'news' && sourceUrl ? `news|${sourceUrl}` : undefined;
      if (known.has(key) || (urlKey && this.sourceUrls.has(urlKey))) continue;
      known.add(key);
      if (sourceUrl) this.sourceUrls.add(`${event.source}|${sourceUrl}`);
      this.events.push({ ...event, id: `mem-${this.nextId++}` });
      inserted++;
    }
    return inserted;
  }
  async findSourceUrls(source: FireSource): Promise<Set<string>> {
    const prefix = `${source}|`;
    return new Set([...this.sourceUrls].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)));
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
