import type { FireEvent, FireSource, NewFireEvent, StoredFireEvent } from '../model/FireEvent.js';
import type { DailyWeather } from '../model/DailyWeather.js';
import type { Hotspot, NewHotspot, RawDetection } from '../model/Hotspot.js';
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

/** Daily weather of the last FORECAST_HISTORY_DAYS days (inputs of the 72 h forecast). */
export interface DailyWeatherRepository {
  /** Stored days of a zone between `from` and `to` (local YYYY-MM-DD, inclusive), oldest first. */
  findRange(zoneId: string, from: string, to: string): Promise<DailyWeather[]>;
  /** Inserts or replaces each zone-day, then deletes days before `keepFrom`. */
  upsertMany(days: readonly DailyWeather[], keepFrom: string): Promise<void>;
}

/** Raw VIIRS detections (one per satellite pass) of the last FORECAST_HISTORY_DAYS days. */
export interface HotspotDetectionRepository {
  /** Detections at or after `since` (ISO date-time). */
  findSince(since: string): Promise<RawDetection[]>;
  /**
   * Adds the detections not stored yet (same source, place and time = same detection), records
   * `completeUtcDays` as fully fetched from FIRMS, and deletes what is older than `keepFrom` (UTC day).
   */
  saveFetch(detections: readonly RawDetection[], completeUtcDays: readonly string[], keepFrom: string): Promise<void>;
  /** UTC days (YYYY-MM-DD) fully fetched from FIRMS, from `from` on. */
  findCompleteDays(from: string): Promise<string[]>;
}
