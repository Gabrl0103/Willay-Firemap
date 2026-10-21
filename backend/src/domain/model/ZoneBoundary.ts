/** [longitude, latitude], as GeoJSON writes them. */
export type Position = readonly [number, number];

export type BoundaryGeometry =
  | { readonly type: 'Polygon'; readonly coordinates: readonly (readonly Position[])[] }
  | { readonly type: 'MultiPolygon'; readonly coordinates: readonly (readonly (readonly Position[])[])[] };

/** Outline of a zone on the map (simplified municipal boundary from DANE's MGN). */
export interface ZoneBoundary {
  readonly zoneId: string;
  /** DIVIPOLA code (DANE): the key used to join the boundary with the zone. */
  readonly divipola: number;
  readonly name: string;
  readonly geometry: BoundaryGeometry;
}
