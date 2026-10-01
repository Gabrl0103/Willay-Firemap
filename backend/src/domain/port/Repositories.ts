import type { FireEvent, NewFireEvent } from '../model/FireEvent.js';
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
  /** Skips duplicates (same zone, place and date). Returns how many events were new. */
  saveMany(events: readonly NewFireEvent[]): Promise<number>;
}

export interface HotspotRepository {
  findAll(): Promise<Hotspot[]>;
  /** Hotspots are "recent detections": each ingestion replaces the previous window. */
  replaceAll(hotspots: readonly NewHotspot[]): Promise<void>;
}
