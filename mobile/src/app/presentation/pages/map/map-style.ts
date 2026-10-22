import type { MapOptions } from 'maplibre-gl';

/** A MapLibre style object (MapOptions also accepts a URL, which the app never uses: nothing from a CDN). */
export type MapStyle = Exclude<MapOptions['style'], string | undefined>;

/** Globe by default; flat when the phone cannot keep the globe above 30 fps (see map-camera.ts). */
export type MapProjection = 'globe' | 'mercator';

/** Standard OpenStreetMap raster tiles (no API key), loaded only as the camera needs them. */
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const OSM_SOURCE = 'osm';
/** Same as --bg: what shows between the globe and the edges, and under tiles still loading. */
export const MAP_BACKGROUND = '#0b0604';

/**
 * OSM tiles are light. The raster shader maps each channel to min + (max - min) * value, so a
 * minimum above the maximum inverts them (white land turns almost black, dark roads light); the hue
 * turns 180° back after the inversion and most of the color goes, like the old CSS filter.
 */
export const DARK_RASTER_PAINT = {
  'raster-brightness-min': 0.42,
  'raster-brightness-max': 0.04,
  'raster-hue-rotate': 180,
  'raster-saturation': -0.7,
  'raster-contrast': 0.1,
  'raster-opacity': 0.9,
} as const;

/**
 * Space around the globe: dark like the app, with a faint orange glow at the horizon. The physical
 * (blue) atmosphere stays off; the glow comes from the sky's horizon color.
 */
export const GLOBE_SKY = {
  'sky-color': MAP_BACKGROUND,
  'horizon-color': '#ff8a2b',
  'sky-horizon-blend': 0.55,
  'atmosphere-blend': 0,
} as const;

/** Base style: background and dark OSM tiles. Zones, boundaries and hotspots are added by map-layers.ts. */
export function mapStyle(projection: MapProjection): MapStyle {
  return {
    version: 8,
    projection: { type: projection },
    ...(projection === 'globe' ? { sky: { ...GLOBE_SKY } } : {}),
    sources: {
      [OSM_SOURCE]: { type: 'raster', tiles: [OSM_TILES], tileSize: 256, maxzoom: 19, attribution: OSM_ATTRIBUTION },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': MAP_BACKGROUND } },
      { id: 'osm-tiles', type: 'raster', source: OSM_SOURCE, paint: { ...DARK_RASTER_PAINT } },
    ],
  };
}
