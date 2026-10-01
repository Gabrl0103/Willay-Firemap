export interface Hotspot {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  /** ISO date-time */
  readonly detectedAt: string;
}

/** A hotspot that is not stored yet (the database gives it an id). */
export type NewHotspot = Omit<Hotspot, 'id'>;
