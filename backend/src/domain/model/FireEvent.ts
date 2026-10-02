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

/** A fire event that is not stored yet (the database gives it an id). */
export interface NewFireEvent extends Omit<FireEvent, 'id'> {
  /** Page or dataset where the event was found (for news: the first article about the fire). */
  readonly sourceUrl?: string;
  /** Later articles about the same fire, kept only as references. */
  readonly relatedUrls?: readonly string[];
}

/** A stored event together with its links (FireEvent, what the API serves, leaves them out). */
export interface StoredFireEvent extends NewFireEvent {
  readonly id: string;
}
