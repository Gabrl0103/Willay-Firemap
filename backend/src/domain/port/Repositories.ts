import type { FireEvent, FireSource, NewFireEvent, StoredFireEvent } from '../model/FireEvent.js';
import type { Hotspot, NewHotspot } from '../model/Hotspot.js';
import type { WeatherSnapshot } from '../model/WeatherSnapshot.js';
import type { Zone } from '../model/Zone.js';

export interface ZoneRepository {
  findAll(): Promise<Zone[]>;
  findById(id: string): Promise<Zone | undefined>;
}

export interface WeatherRepository {
  /** Most recent snapshot of the zone. */
  findByZoneId(zoneId: string): Promise<WeatherSnapshot | undefined>;
  save(snapshot: WeatherSnapshot): Promise<void>;
}

export interface FireEventRepository {
  findAll(): Promise<FireEvent[]>;
  /** Skips duplicates (same zone, place and date, or a news page already stored). Returns how many were new. */
  saveMany(events: readonly NewFireEvent[]): Promise<number>;
  /** URLs already stored for a source, main and related (to skip news pages read before). */
  findSourceUrls(source: FireSource): Promise<Set<string>>;
  /** Stored news events with their links, to group new articles with the fires already known. */
  findNewsEvents(): Promise<StoredFireEvent[]>;
  /** Writes `fire` over the event `keepId` and deletes `duplicateIds` (the same fire), atomically. */
  replaceSameFire(keepId: string, fire: NewFireEvent, duplicateIds: readonly string[]): Promise<void>;
}

export interface HotspotRepository {
  findAll(): Promise<Hotspot[]>;
  /** Hotspots are "recent detections": each ingestion replaces the previous window. */
  replaceAll(hotspots: readonly NewHotspot[]): Promise<void>;
}
