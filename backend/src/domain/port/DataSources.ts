import type { NewFireEvent } from '../model/FireEvent.js';
import type { HotspotDetection } from '../model/Hotspot.js';
import type { WeatherSnapshot } from '../model/WeatherSnapshot.js';
import type { Zone } from '../model/Zone.js';

/** External sources the backend ingests from. Implementations live in infrastructure/. */

export interface WeatherProvider {
  /** Current conditions for each zone (same order is not guaranteed). */
  fetchCurrent(zones: readonly Zone[]): Promise<WeatherSnapshot[]>;
}

export interface HotspotProvider {
  /** Hotspots detected over Nariño in the last days, one row per satellite detection. */
  fetchRecent(): Promise<HotspotDetection[]>;
}

/** What a fire source collected in one run. */
export interface FireReportBatch {
  /** Items the source looked at (news items about fires, dataset rows). */
  readonly itemsRead: number;
  /** Items about a wildfire, wherever it was (many happen outside the known zones). */
  readonly wildfireItems: number;
  /** Items that became events in one of the given zones. */
  readonly events: NewFireEvent[];
}

/** A site or dataset with past fires (scraping). Events must point to one of the given zones. */
export interface FireReportSource {
  readonly name: string;
  /** `knownSourceUrls`: pages already stored, so the source can skip them. */
  fetchReports(zones: readonly Zone[], knownSourceUrls: ReadonlySet<string>): Promise<FireReportBatch>;
}
