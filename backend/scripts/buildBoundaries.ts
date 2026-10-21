/**
 * npm run geo:boundaries -- [zip] — builds the municipal boundaries of Nariño served by
 * GET /api/zones/boundaries, from DANE's MGN (layer MGN_ADM_MPIO_GRAFICO, "Nivel Municipio", Shapefile).
 *
 * The zip is downloaded by hand from geoportal.dane.gov.co (its robots.txt asks for a 120 s delay and
 * night visits) into backend/data/raw/, which stays out of git. Steps: keep department 52, simplify
 * with mapshaper (topology-aware, so neighbours share their edges and no gaps appear), keep only the
 * DIVIPOLA code and name, round to 0.0001° (~11 m) and check the 64 codes against NARINO_MUNICIPALITIES.
 *
 * Simplification compared on MGN2025 (2026-10-21; KB without / with gzip): 2.7 % → 149 / 42,
 * 3 % → 163 / 46, 5 % → 261 / 75, 8 % → 408 / 115, 12 % → 600 / 165. 2.7 % (~8,100 vertices) keeps the
 * Pacific coast recognisable (Tumaco bay and its inlets; only islets of a few hundred metres go) and
 * stays within ~150 KB.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mapshaper from 'mapshaper';
import { NARINO_MUNICIPALITIES } from '../src/infrastructure/persistence/narinoMunicipalities.js';

const SIMPLIFY = '2.7%';
const PRECISION = 0.0001;
const NARINO_DPTO = '52';
const DEFAULT_ZIP = 'data/raw/MGN2025_MPIO_GRAFICO.zip';
const OUTPUT = 'src/infrastructure/geo/narino-boundaries-mgn2025.json';

interface Feature {
  type: 'Feature';
  properties: { divipola: number; name: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}

const zip = process.argv[2] ?? DEFAULT_ZIP;
const workDir = mkdtempSync(join(tmpdir(), 'willay-boundaries-'));
const simplified = join(workDir, 'narino.json');
try {
  await mapshaper.runCommands(
    `-i "${zip}" -filter "dpto_ccdgo === '${NARINO_DPTO}'" ` +
      `-simplify visvalingam weighted ${SIMPLIFY} keep-shapes -clean ` +
      `-each "divipola = Number(mpio_cdpmp), name = mpio_cnmbr" -filter-fields divipola,name ` +
      `-o "${simplified}" format=geojson precision=${PRECISION}`,
  );
  const { features } = JSON.parse(readFileSync(simplified, 'utf8')) as { features: Feature[] };
  features.sort((a, b) => a.properties.divipola - b.properties.divipola);

  const known = new Set(NARINO_MUNICIPALITIES.map((m) => m.divipola));
  const found = new Set(features.map((f) => f.properties.divipola));
  const missing = [...known].filter((code) => !found.has(code));
  const unknown = [...found].filter((code) => !known.has(code));
  if (missing.length > 0 || unknown.length > 0 || features.length !== known.size) {
    throw new Error(
      `Codes do not match the zone table: ${features.length} features, ` +
        `missing ${missing.join(', ') || 'none'}, unknown ${unknown.join(', ') || 'none'}`,
    );
  }

  // One feature per line: readable diffs when the MGN is updated.
  const body = `{"type":"FeatureCollection","features":[\n${features.map((f) => JSON.stringify(f)).join(',\n')}\n]}\n`;
  writeFileSync(OUTPUT, body);
  const sha256 = createHash('sha256').update(readFileSync(zip)).digest('hex');
  console.log(`${features.length}/${known.size} municipalities matched by DIVIPOLA code.`);
  console.log(`Wrote ${OUTPUT}: ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB (simplify ${SIMPLIFY}).`);
  console.log(`Source ${zip} sha256 ${sha256}`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
