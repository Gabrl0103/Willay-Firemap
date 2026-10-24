import type { ExpressionSpecification, MapOptions } from 'maplibre-gl';

/** A MapLibre style object (MapOptions also accepts a URL, which the app never uses: nothing from a CDN). */
export type MapStyle = Exclude<MapOptions['style'], string | undefined>;

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
 * Seen from far (the globe), the same inversion with lighter land and a bit more color, so the
 * continents stand out from the dark space. It turns into DARK_RASTER_PAINT on the way in.
 */
export const GLOBE_RASTER_PAINT = {
  'raster-brightness-min': 0.56,
  'raster-brightness-max': 0.2,
  'raster-hue-rotate': 180,
  'raster-saturation': -0.45,
  'raster-contrast': 0,
  'raster-opacity': 1,
} as const;
/** Up to this zoom the tiles are GLOBE_RASTER_PAINT... */
export const GLOBE_TILES_ZOOM = 3;
/** ...and from this one DARK_RASTER_PAINT. */
export const DARK_TILES_ZOOM = 5;

type RasterPaintKey = keyof typeof DARK_RASTER_PAINT;

/** Raster paint that goes from the globe's lighter tiles to the dark ones as the camera comes in. */
export function rasterPaint(): Record<RasterPaintKey, number | ExpressionSpecification> {
  const paint = {} as Record<RasterPaintKey, number | ExpressionSpecification>;
  for (const key of Object.keys(DARK_RASTER_PAINT) as RasterPaintKey[]) {
    const far = GLOBE_RASTER_PAINT[key];
    const near = DARK_RASTER_PAINT[key];
    paint[key] = far === near ? near : ['interpolate', ['linear'], ['zoom'], GLOBE_TILES_ZOOM, far, DARK_TILES_ZOOM, near];
  }
  return paint;
}

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

/** Base style: the globe, background and dark OSM tiles. Zones, boundaries and hotspots are added by map-layers.ts. */
export function mapStyle(): MapStyle {
  return {
    version: 8,
    projection: { type: 'globe' },
    sky: { ...GLOBE_SKY },
    sources: {
      [OSM_SOURCE]: { type: 'raster', tiles: [OSM_TILES], tileSize: 256, maxzoom: 19, attribution: OSM_ATTRIBUTION },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': MAP_BACKGROUND } },
      { id: 'osm-tiles', type: 'raster', source: OSM_SOURCE, paint: rasterPaint() },
    ],
  };
}
