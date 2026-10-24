import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const KEY = 'favorites.zoneIds';

/** Where the list is kept: Preferences (native storage on the phone, localStorage in the browser). */
export interface FavoritesStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

export const FAVORITES_STORAGE = new InjectionToken<FavoritesStorage>('FAVORITES_STORAGE', {
  providedIn: 'root',
  factory: () => ({
    read: async () => (await Preferences.get({ key: KEY })).value,
    write: (value) => Preferences.set({ key: KEY, value }),
  }),
});

/** The saved ids; anything that is not a list of texts (old or broken data) reads as no favorites. */
export function parseFavoriteIds(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string'))] : [];
  } catch {
    return [];
  }
}

/** Municipalities marked with the heart, only on this phone: no account and no backend. */
@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  private readonly storage = inject(FAVORITES_STORAGE);

  /** Zone ids in the order they were added. */
  readonly ids = signal<readonly string[]>([]);
  private loading?: Promise<void>;

  constructor() {
    void this.load();
  }

  /** Reads the saved list once; without storage the favorites live only while the app is open. */
  load(): Promise<void> {
    this.loading ??= this.storage
      .read()
      .then((value) => this.ids.set(parseFavoriteIds(value)))
      .catch(() => undefined);
    return this.loading;
  }

  isFavorite(zoneId: string): boolean {
    return this.ids().includes(zoneId);
  }

  /** Adds or removes the zone (after the saved list is read, so it is not lost); true if it is now a favorite. */
  async toggle(zoneId: string): Promise<boolean> {
    await this.load();
    const ids = this.ids();
    const next = ids.includes(zoneId) ? ids.filter((id) => id !== zoneId) : [...ids, zoneId];
    this.ids.set(next);
    await this.storage.write(JSON.stringify(next)).catch(() => undefined);
    return next.includes(zoneId);
  }
}
