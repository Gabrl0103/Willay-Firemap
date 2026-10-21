import type { AddLayerObject, Map as MapLibreMap } from 'maplibre-gl';
import type { RiskLevel, ZoneRiskSummary } from '../../../domain/model/risk';
import { levelFromScore } from '../../../domain/util/department-summary';

type SourceSpecification = Parameters<MapLibreMap['addSource']>[1];

export const ZONES_SOURCE = 'zones';
/** Invisible: MapLibre only loads (and clusters) a source that some layer uses. */
export const ZONES_HIT_LAYER = 'zones-hit';
/**
 * Up to this zoom nearby seats are grouped. Above it (zooming into the Andes, where the seats are a
 * few km apart) every municipality has its own marker, and from zoom 10 its name.
 */
export const CLUSTER_MAX_ZOOM = 8;
/** Seats closer than this (px) on screen go into one group: a bit more than two 18 px markers. */
export const CLUSTER_RADIUS = 44;

/** The seats as GeoJSON points, grouped by MapLibre; a group keeps the highest score of its zones. */
export function zonesSource(zones: readonly ZoneRiskSummary[]): SourceSpecification {
  return {
    type: 'geojson',
    cluster: true,
    clusterRadius: CLUSTER_RADIUS,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    clusterProperties: { maxScore: ['max', ['get', 'score']] },
    data: {
      type: 'FeatureCollection',
      features: zones.map((zone) => ({
        type: 'Feature',
        properties: { id: zone.id, score: zone.score },
        geometry: { type: 'Point', coordinates: [zone.longitude, zone.latitude] },
      })),
    },
  };
}

export const zonesHitLayer: AddLayerObject = {
  id: ZONES_HIT_LAYER,
  type: 'circle',
  source: ZONES_SOURCE,
  paint: { 'circle-radius': 1, 'circle-opacity': 0 },
};

/** What a point of the zones source says, as querySourceFeatures returns it. */
export interface SourcePoint {
  readonly properties: Readonly<Record<string, unknown>>;
  readonly geometry: { readonly type: string; readonly coordinates?: unknown };
}

export type MarkerItem =
  | { readonly kind: 'zone'; readonly key: string; readonly zoneId: string; readonly lngLat: [number, number] }
  | {
      readonly kind: 'cluster';
      readonly key: string;
      readonly clusterId: number;
      readonly count: number;
      /** Level of the worst zone in the group: the color of its marker. */
      readonly level: RiskLevel;
      readonly lngLat: [number, number];
    };

function pointCoordinates(point: SourcePoint): [number, number] | null {
  const { coordinates } = point.geometry;
  if (point.geometry.type !== 'Point' || !Array.isArray(coordinates)) return null;
  const [longitude, latitude] = coordinates as unknown[];
  return typeof longitude === 'number' && typeof latitude === 'number' ? [longitude, latitude] : null;
}

/**
 * The markers to show for what the zones source has on screen: one per group and one per lone
 * zone. querySourceFeatures repeats a point once per tile it touches, so items are unique by key.
 */
export function markerItems(points: readonly SourcePoint[]): MarkerItem[] {
  const items = new Map<string, MarkerItem>();
  for (const point of points) {
    const lngLat = pointCoordinates(point);
    if (!lngLat) continue;
    const { cluster_id: clusterId, point_count: count, maxScore, id } = point.properties;
    if (point.properties['cluster'] === true && typeof clusterId === 'number' && typeof count === 'number') {
      const score = typeof maxScore === 'number' ? maxScore : 0;
      items.set(`cluster:${clusterId}`, { kind: 'cluster', key: `cluster:${clusterId}`, clusterId, count, level: levelFromScore(score), lngLat });
    } else if (typeof id === 'string') {
      items.set(`zone:${id}`, { kind: 'zone', key: `zone:${id}`, zoneId: id, lngLat });
    }
  }
  return [...items.values()];
}

/** Which markers to create and which to remove so the map shows exactly `items`. */
export function diffMarkers(shown: ReadonlySet<string>, items: readonly MarkerItem[]): { add: MarkerItem[]; remove: string[] } {
  const wanted = new Set(items.map((item) => item.key));
  return {
    add: items.filter((item) => !shown.has(item.key)),
    remove: [...shown].filter((key) => !wanted.has(key)),
  };
}
