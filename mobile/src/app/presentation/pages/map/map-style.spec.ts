import {
  DARK_RASTER_PAINT, DARK_TILES_ZOOM, GLOBE_RASTER_PAINT, GLOBE_TILES_ZOOM, MAP_BACKGROUND, OSM_ATTRIBUTION, mapStyle, rasterPaint,
} from './map-style';

describe('map style', () => {
  it('always uses the globe, with a dark sky', () => {
    const globe = mapStyle();
    expect(globe.projection).toEqual({ type: 'globe' });
    expect(globe.sky?.['sky-color']).toBe(MAP_BACKGROUND);
  });

  it('darkens the OSM tiles with raster paint (inverted brightness), not a CSS filter', () => {
    expect(DARK_RASTER_PAINT['raster-brightness-min']).toBeGreaterThan(DARK_RASTER_PAINT['raster-brightness-max']);
    expect(GLOBE_RASTER_PAINT['raster-brightness-min']).toBeGreaterThan(GLOBE_RASTER_PAINT['raster-brightness-max']);
    const tiles = mapStyle().layers.find((layer) => layer.type === 'raster');
    expect(tiles?.paint).toEqual(rasterPaint());
  });

  it('shows lighter tiles on the globe and the dark ones once zoomed in', () => {
    expect(GLOBE_RASTER_PAINT['raster-brightness-max']).toBeGreaterThan(DARK_RASTER_PAINT['raster-brightness-max']);
    expect(GLOBE_RASTER_PAINT['raster-brightness-min']).toBeGreaterThan(DARK_RASTER_PAINT['raster-brightness-min']);
    const paint = rasterPaint();
    expect(paint['raster-brightness-max']).toEqual([
      'interpolate', ['linear'], ['zoom'],
      GLOBE_TILES_ZOOM, GLOBE_RASTER_PAINT['raster-brightness-max'], DARK_TILES_ZOOM, DARK_RASTER_PAINT['raster-brightness-max'],
    ]);
    // What does not change stays a plain value.
    expect(paint['raster-hue-rotate']).toBe(180);
  });

  it('credits OpenStreetMap and loads nothing else from the network (no glyphs, no sprite)', () => {
    const style = mapStyle();
    const osm = style.sources['osm'];
    expect(osm?.type).toBe('raster');
    expect(osm && 'attribution' in osm ? osm.attribution : undefined).toBe(OSM_ATTRIBUTION);
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
  });

  it('starts with the app background', () => {
    const background = mapStyle().layers[0];
    expect(background?.type).toBe('background');
    expect(background?.paint).toEqual({ 'background-color': MAP_BACKGROUND });
  });
});
