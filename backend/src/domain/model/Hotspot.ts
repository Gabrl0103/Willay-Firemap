export interface Hotspot {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  /** ISO date-time */
  readonly detectedAt: string;
}

/** A hotspot that is not stored yet (the database gives it an id). */
export type NewHotspot = Omit<Hotspot, 'id'>;

/** Detection confidence as VIIRS reports it (l / n / h). */
export type HotspotConfidence = 'low' | 'nominal' | 'high';

/** A detection as a satellite source reports it, before duplicates between satellites are removed. */
export interface HotspotDetection extends NewHotspot {
  /** FIRMS source, e.g. "VIIRS_NOAA20_NRT". */
  readonly source: string;
  readonly confidence: HotspotConfidence;
  /** Fire radiative power (MW), used to break ties between equally confident detections. */
  readonly frp?: number;
}
