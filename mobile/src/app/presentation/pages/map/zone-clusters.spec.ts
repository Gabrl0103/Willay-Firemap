import type { ZoneRiskSummary } from '../../../domain/model/risk';
import { MIN_ZOOM_OVER_NARINO } from './map-camera';
import { CLUSTER_MAX_ZOOM, diffMarkers, markerItems, zonesSource, type SourcePoint } from './zone-clusters';
import { NAME_MIN_ZOOM } from './zone-marker';

const zone = (id: string, score: number): ZoneRiskSummary => ({
  id, name: id, latitude: 1.2, longitude: -77.3, score, level: 'low',
});
const point = (properties: Record<string, unknown>, coordinates: unknown = [-77.3, 1.2]): SourcePoint => ({
  properties,
  geometry: { type: 'Point', coordinates },
});

describe('zone clusters', () => {
  it('groups the seats and keeps the highest score of each group', () => {
    const source = zonesSource([zone('pasto', 37), zone('ipiales', 81)]);
    expect(source).toMatchObject({ type: 'geojson', cluster: true, clusterMaxZoom: CLUSTER_MAX_ZOOM, clusterProperties: { maxScore: ['max', ['get', 'score']] } });
    expect(source.type === 'geojson' ? source.data : null).toEqual({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { id: 'pasto', score: 37 }, geometry: { type: 'Point', coordinates: [-77.3, 1.2] } },
        { type: 'Feature', properties: { id: 'ipiales', score: 81 }, geometry: { type: 'Point', coordinates: [-77.3, 1.2] } },
      ],
    });
  });

  it('only groups in far views: over Nariño every municipality has its own marker', () => {
    expect(CLUSTER_MAX_ZOOM).toBeLessThan(MIN_ZOOM_OVER_NARINO);
    expect(CLUSTER_MAX_ZOOM).toBeLessThan(NAME_MIN_ZOOM);
  });

  it('makes one marker per group (colored by its worst zone) and per lone zone, without repeats', () => {
    const items = markerItems([
      point({ cluster: true, cluster_id: 12, point_count: 5, maxScore: 62 }),
      point({ cluster: true, cluster_id: 12, point_count: 5, maxScore: 62 }), // same group, next tile
      point({ id: 'tumaco', score: 20 }, [-78.76, 1.81]),
      point({ id: 'broken' }, 'not coordinates'),
    ]);
    expect(items).toEqual([
      { kind: 'cluster', key: 'cluster:12', clusterId: 12, count: 5, level: 'high', lngLat: [-77.3, 1.2] },
      { kind: 'zone', key: 'zone:tumaco', zoneId: 'tumaco', lngLat: [-78.76, 1.81] },
    ]);
  });

  it('only adds the new markers and removes the ones that left', () => {
    const items = markerItems([point({ id: 'pasto' }), point({ cluster: true, cluster_id: 3, point_count: 2, maxScore: 10 })]);
    const { add, remove } = diffMarkers(new Set(['zone:pasto', 'cluster:9']), items);
    expect(add.map((item) => item.key)).toEqual(['cluster:3']);
    expect(remove).toEqual(['cluster:9']);
  });
});
