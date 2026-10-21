import type { BoundaryGeometry, ZoneBoundary } from '../model/ZoneBoundary.js';

/** A boundary as the source gives it: only its DIVIPOLA code says which municipality it is. */
export interface CodedBoundary {
  readonly divipola: number;
  readonly geometry: BoundaryGeometry;
}

/** A zone with its DIVIPOLA code. */
export interface CodedZone {
  readonly divipola: number;
  readonly id: string;
  readonly name: string;
}

export interface BoundaryJoin {
  /** In the order of the zones. */
  readonly boundaries: ZoneBoundary[];
  /** Codes in the source that no zone has (or repeated in the source). */
  readonly unmatchedCodes: number[];
  /** Zones the source has no boundary for. */
  readonly zonesWithoutBoundary: string[];
}

/**
 * Joins boundaries and zones by DIVIPOLA code, never by name: DANE writes "SAN ANDRÉS DE TUMACO" or
 * "CUASPUD CARLOSAMA" in capitals, the zones keep their own names and ids.
 */
export function joinBoundaries(source: readonly CodedBoundary[], zones: readonly CodedZone[]): BoundaryJoin {
  const byCode = new Map<number, CodedBoundary>();
  const unmatchedCodes: number[] = [];
  for (const boundary of source) {
    if (byCode.has(boundary.divipola)) unmatchedCodes.push(boundary.divipola);
    else byCode.set(boundary.divipola, boundary);
  }
  const zoneCodes = new Set(zones.map((zone) => zone.divipola));
  for (const code of byCode.keys()) if (!zoneCodes.has(code)) unmatchedCodes.push(code);

  const boundaries: ZoneBoundary[] = [];
  const zonesWithoutBoundary: string[] = [];
  for (const zone of zones) {
    const boundary = byCode.get(zone.divipola);
    if (boundary) boundaries.push({ zoneId: zone.id, divipola: zone.divipola, name: zone.name, geometry: boundary.geometry });
    else zonesWithoutBoundary.push(zone.id);
  }
  return { boundaries, unmatchedCodes, zonesWithoutBoundary };
}
