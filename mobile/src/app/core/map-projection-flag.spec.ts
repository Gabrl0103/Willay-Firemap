import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';
import { MapProjectionFlag } from './map-projection-flag';

describe('MapProjectionFlag', () => {
  beforeEach(async () => {
    await Preferences.remove({ key: 'map.projection' });
  });

  it('opens the globe until the phone proved too slow, then stays flat', async () => {
    const flag = TestBed.inject(MapProjectionFlag);
    expect(await flag.projection()).toBe('globe');
    await flag.rememberFlat();
    expect(await flag.projection()).toBe('mercator');
  });
});
