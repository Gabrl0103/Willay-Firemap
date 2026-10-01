import type { NewFireEvent } from '../model/FireEvent.js';
import type { NewHotspot } from '../model/Hotspot.js';
import type { WeatherSnapshot } from '../model/WeatherSnapshot.js';
import type { Zone } from '../model/Zone.js';

/** External sources the backend ingests from. Implementations live in infrastructure/. */

export interface WeatherProvider {
  /** Current conditions for each zone (same order is not guaranteed). */
  fetchCurrent(zones: readonly Zone[]): Promise<WeatherSnapshot[]>;
}

export interface HotspotProvider {
  /** Hotspots detected over Nariño in the last days. */
  fetchRecent(): Promise<NewHotspot[]>;
}

/** A site or dataset with past fires (scraping). Events must point to one of the given zones. */
export interface FireReportSource {
  readonly name: string;
  fetchReports(zones: readonly Zone[]): Promise<NewFireEvent[]>;
}
