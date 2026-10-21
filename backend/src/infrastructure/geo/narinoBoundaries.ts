import type { BoundaryGeometry } from '../../domain/model/ZoneBoundary.js';
import { joinBoundaries, type CodedBoundary } from '../../domain/service/boundaryJoin.js';
import { NARINO_MUNICIPALITIES } from '../persistence/narinoMunicipalities.js';
import source from './narino-boundaries-mgn2025.json' with { type: 'json' };

/**
 * Municipal boundaries of Nariño, from DANE's Marco Geoestadístico Nacional (MGN) 2025, layer
 * MGN_ADM_MPIO_GRAFICO ("Versión MGN2025-Nivel Municipio", Shapefile, zip sha256
 * a3c01393059be8f2947de5e0a828faa4c7a43119819a667a8124854340bc141f, downloaded 2026-10-21 from
 * geoportal.dane.gov.co). Simplified to 2.7 % with `npm run geo:boundaries` (see scripts/buildBoundaries.ts).
 *
 * Terms of use of DANE: use and transformation allowed with the citation
 * "Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co" (shown in the app).
 */
export const BOUNDARY_SOURCE = 'DANE, Marco Geoestadístico Nacional 2025';

interface SourceFeature {
  readonly properties: { readonly divipola: number };
  readonly geometry: BoundaryGeometry;
}

const coded: CodedBoundary[] = (source.features as unknown as SourceFeature[]).map((feature) => ({
  divipola: feature.properties.divipola,
  geometry: feature.geometry,
}));

/** Joined once at start-up; the file and the zone list only change together (tests check 64/64). */
export const NARINO_BOUNDARIES = joinBoundaries(coded, NARINO_MUNICIPALITIES);
