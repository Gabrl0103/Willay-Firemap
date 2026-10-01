export interface Hotspot {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  /** ISO date-time */
  readonly detectedAt: string;
}
