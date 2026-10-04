import { NotFoundError } from '../../domain/error/DomainErrors.js';
import type { RiskAssessment } from '../../domain/model/RiskAssessment.js';
import type { WeatherSnapshot } from '../../domain/model/WeatherSnapshot.js';
import type { Zone } from '../../domain/model/Zone.js';
import type {
  FireEventRepository,
  HotspotRepository,
  WeatherRepository,
} from '../../domain/port/Repositories.js';
import { firesPerYear } from '../../domain/service/fireFrequency.js';
import { distanceKm } from '../../domain/service/geo.js';
import { hotspotWeight } from '../../domain/service/hotspotRecency.js';
import type { RiskScoringService } from '../../domain/service/RiskScoringService.js';

export interface ZoneRisk {
  readonly weather: WeatherSnapshot;
  readonly assessment: RiskAssessment;
  /** Stored hotspots within HOTSPOT_RADIUS_KM (any age in the window) and the newest detection. */
  readonly nearbyHotspots: NearbyHotspots;
}

export interface NearbyHotspots {
  readonly count: number;
  /** ISO date-time, or null when there are none. */
  readonly latestDetectedAt: string | null;
}

export const HOTSPOT_RADIUS_KM = 25;
/** First day of the fire records (the UNGRD dataset starts on 2019-01-02). */
export const FIRE_RECORD_START = '2019-01-01';

/** Gathers the data of one zone and asks the domain for its risk (shared by use cases). */
export class ZoneRiskCalculator {
  constructor(
    private readonly weatherRepository: WeatherRepository,
    private readonly fireEventRepository: FireEventRepository,
    private readonly hotspotRepository: HotspotRepository,
    private readonly scoringService: RiskScoringService,
  ) {}

  async calculate(zone: Zone, now: Date = new Date()): Promise<ZoneRisk> {
    const weather = await this.weatherRepository.findByZoneId(zone.id);
    if (!weather) throw new NotFoundError(`No weather data for zone ${zone.id}`);

    const [hotspots, fires] = await Promise.all([
      this.hotspotRepository.findAll(),
      this.fireEventRepository.findAll(),
    ]);

    const nearby = hotspots.filter(
      (h) => distanceKm(zone.latitude, zone.longitude, h.latitude, h.longitude) <= HOTSPOT_RADIUS_KM,
    );
    // Recent detections count fully, older ones less (hotspotRecency.ts).
    const nearbyHotspotCount = nearby.reduce((sum, h) => sum + hotspotWeight(h.detectedAt, now), 0);
    const latestDetectedAt = nearby.reduce<string | null>(
      (latest, h) => (latest === null || Date.parse(h.detectedAt) > Date.parse(latest) ? h.detectedAt : latest),
      null,
    );

    const zoneFireDates = fires.filter((f) => f.zoneId === zone.id).map((f) => f.date);
    const assessment = this.scoringService.assess({
      weather,
      nearbyHotspotCount,
      firesPerYear: firesPerYear(zoneFireDates, FIRE_RECORD_START, now),
    });
    return { weather, assessment, nearbyHotspots: { count: nearby.length, latestDetectedAt } };
  }
}
