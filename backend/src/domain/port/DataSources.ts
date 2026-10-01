import type { NewFireEvent } from '../model/FireEvent.js';
import type { NewHotspot } from '../model/Hotspot.js';
import type { WeatherSnapshot } from '../model/WeatherSnapshot.js';
import type { Zone } from '../model/Zone.js';

/** External sources the backend ingests from. Implementations live in infrastructure/. */

export interface WeatherProvider {
  /** Current conditions for each zone (same order is not guaranteed). */
  fetchCurrent(zones: readonly Zone[]): Promise<WeatherSnapshot[]>;
}
