import type { ZoneRiskSummary } from '../model/risk';
import { favoriteZones } from './favorites';

const zone = (id: string, score: number): ZoneRiskSummary => ({
  id, name: id, latitude: 1.2, longitude: -77.3, score, level: 'low',
});

describe('favoriteZones', () => {
  it('keeps the order of the favorites and skips the ones no zone has', () => {
    const zones = [zone('pasto', 37), zone('ipiales', 12), zone('tumaco', 20)];
    expect(favoriteZones(['tumaco', 'borrado', 'pasto'], zones).map((z) => z.id)).toEqual(['tumaco', 'pasto']);
    expect(favoriteZones([], zones)).toEqual([]);
    expect(favoriteZones(['pasto'], [])).toEqual([]);
  });
});
