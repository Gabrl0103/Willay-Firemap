import type { FireEvent } from '../model/FireEvent.js';
import type { Hotspot } from '../model/Hotspot.js';
import type { WeatherSnapshot } from '../model/WeatherSnapshot.js';
import type { Zone } from '../model/Zone.js';

export interface ZoneRepository {
  findAll(): Promise<Zone[]>;
  findById(id: string): Promise<Zone | undefined>;
}

export interface WeatherRepository {
  findByZoneId(zoneId: string): Promise<WeatherSnapshot | undefined>;
}

export interface FireEventRepository {
  findAll(): Promise<FireEvent[]>;
}

export interface HotspotRepository {
  findAll(): Promise<Hotspot[]>;
}
