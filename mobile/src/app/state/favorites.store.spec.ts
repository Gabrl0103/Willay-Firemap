import { TestBed } from '@angular/core/testing';
import { FAVORITES_STORAGE, FavoritesStore, parseFavoriteIds, type FavoritesStorage } from './favorites.store';

function setup(saved: string | null, storage: Partial<FavoritesStorage> = {}) {
  const written: string[] = [];
  TestBed.configureTestingModule({
    providers: [{
      provide: FAVORITES_STORAGE,
      useValue: {
        read: async () => saved,
        write: async (value: string) => void written.push(value),
        ...storage,
      } satisfies FavoritesStorage,
    }],
  });
  return { store: TestBed.inject(FavoritesStore), written };
}

describe('FavoritesStore', () => {
  it('reads the saved favorites in the order they were added', async () => {
    const { store } = setup('["pasto","tumaco"]');
    await store.load();
    expect(store.ids()).toEqual(['pasto', 'tumaco']);
    expect(store.isFavorite('tumaco')).toBe(true);
    expect(store.isFavorite('ipiales')).toBe(false);
  });

  it('adds and removes a favorite and saves the list each time', async () => {
    const { store, written } = setup(null);
    expect(await store.toggle('pasto')).toBe(true);
    expect(await store.toggle('ipiales')).toBe(true);
    expect(store.ids()).toEqual(['pasto', 'ipiales']);
    expect(await store.toggle('pasto')).toBe(false);
    expect(store.ids()).toEqual(['ipiales']);
    expect(written).toEqual(['["pasto"]', '["pasto","ipiales"]', '["ipiales"]']);
  });

  it('keeps the saved list when the heart is tapped before it was read', async () => {
    const { store } = setup('["pasto"]');
    await store.toggle('tumaco');
    expect(store.ids()).toEqual(['pasto', 'tumaco']);
  });

  it('keeps working in memory when there is no storage', async () => {
    const { store } = setup(null, {
      read: () => Promise.reject(new Error('no storage')),
      write: () => Promise.reject(new Error('no storage')),
    });
    expect(await store.toggle('pasto')).toBe(true);
    expect(store.ids()).toEqual(['pasto']);
  });
});

describe('parseFavoriteIds', () => {
  it('reads only a list of texts, without repeats', () => {
    expect(parseFavoriteIds('["pasto","pasto",3,"ipiales"]')).toEqual(['pasto', 'ipiales']);
    expect(parseFavoriteIds(null)).toEqual([]);
    expect(parseFavoriteIds('{"pasto":true}')).toEqual([]);
    expect(parseFavoriteIds('not json')).toEqual([]);
  });
});
