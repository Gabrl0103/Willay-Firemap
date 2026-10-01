export type FireSource = 'news' | 'ungrd';

export interface FireEvent {
  readonly id: string;
  readonly zoneId: string;
  readonly place: string;
  /** ISO date (YYYY-MM-DD) */
  readonly date: string;
  readonly hectares: number;
  readonly source: FireSource;
}
