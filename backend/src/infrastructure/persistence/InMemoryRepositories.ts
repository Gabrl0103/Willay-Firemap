import type { FireEvent } from '../../domain/model/FireEvent.js';
import type { Hotspot } from '../../domain/model/Hotspot.js';
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
  constructor(private readonly snapshots: readonly WeatherSnapshot[]) {}
  async findByZoneId(zoneId: string): Promise<WeatherSnapshot | undefined> {
    return this.snapshots.find((snapshot) => snapshot.zoneId === zoneId);
  }
}

export class InMemoryFireEventRepository implements FireEventRepository {
  constructor(private readonly events: readonly FireEvent[]) {}
  async findAll(): Promise<FireEvent[]> {
    return [...this.events];
  }
}

export class InMemoryHotspotRepository implements HotspotRepository {
  constructor(private readonly hotspots: readonly Hotspot[]) {}
  async findAll(): Promise<Hotspot[]> {
    return [...this.hotspots];
  }
}
