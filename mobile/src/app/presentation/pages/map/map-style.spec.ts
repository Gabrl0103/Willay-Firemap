import { DARK_RASTER_PAINT, MAP_BACKGROUND, OSM_ATTRIBUTION, mapStyle } from './map-style';

describe('map style', () => {
  it('uses the globe with a dark sky, or the flat map without it', () => {
    const globe = mapStyle('globe');
    expect(globe.projection).toEqual({ type: 'globe' });
    expect(globe.sky?.['sky-color']).toBe(MAP_BACKGROUND);

    const flat = mapStyle('mercator');
    expect(flat.projection).toEqual({ type: 'mercator' });
    expect(flat.sky).toBeUndefined();
  });

  it('darkens the OSM tiles with raster paint (inverted brightness), not a CSS filter', () => {
    expect(DARK_RASTER_PAINT['raster-brightness-min']).toBeGreaterThan(DARK_RASTER_PAINT['raster-brightness-max']);
    const tiles = mapStyle('globe').layers.find((layer) => layer.type === 'raster');
    expect(tiles?.paint).toEqual(DARK_RASTER_PAINT);
  });

  it('credits OpenStreetMap and loads nothing else from the network (no glyphs, no sprite)', () => {
    const style = mapStyle('globe');
    const osm = style.sources['osm'];
    expect(osm?.type).toBe('raster');
    expect(osm && 'attribution' in osm ? osm.attribution : undefined).toBe(OSM_ATTRIBUTION);
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
  });

  it('starts with the app background', () => {
    const background = mapStyle('globe').layers[0];
    expect(background?.type).toBe('background');
    expect(background?.paint).toEqual({ 'background-color': MAP_BACKGROUND });
  });
});
