import axios from 'axios';
import type { HotspotConfidence, HotspotDetection } from '../../domain/model/Hotspot.js';
import type { HotspotProvider } from '../../domain/port/DataSources.js';
import { HOTSPOT_WINDOW_DAYS } from '../../domain/service/hotspotRecency.js';

const FIRMS_AREA_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
/** Nariño bounding box: west, south, east, north. */
const NARINO_BBOX = '-79.1,0.35,-76.8,2.7';
/** Near-real-time VIIRS satellites (375 m). NOAA-21 adds more passes over Nariño each day. */
export const FIRMS_SOURCES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'] as const;
/** UTC days up to today (FIRMS accepts 1-5). The model weights older detections less (hotspotRecency.ts). */
export const FIRMS_DAY_RANGE = HOTSPOT_WINDOW_DAYS;

export const firmsAreaUrl = (mapKey: string, source: string): string =>
  `${FIRMS_AREA_URL}/${mapKey}/${source}/${NARINO_BBOX}/${FIRMS_DAY_RANGE}`;

/** GET that returns the body as text (axios by default; tests pass a fake). */
export type TextGetter = (url: string) => Promise<string>;

const axiosGetText: TextGetter = async (url) =>
  (await axios.get<string>(url, { timeout: 30_000, responseType: 'text' })).data;

/** VIIRS writes l / n / h (MODIS writes 0-100). Missing or unknown values count as nominal. */
export function parseConfidence(raw: string | undefined): HotspotConfidence {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'h' || value === 'high') return 'high';
  if (value === 'l' || value === 'low') return 'low';
  const percent = Number(value);
  if (value !== '' && Number.isFinite(percent)) return percent >= 80 ? 'high' : percent < 30 ? 'low' : 'nominal';
  return 'nominal';
}

/**
 * Parses the FIRMS area CSV (latitude, longitude, acq_date YYYY-MM-DD, acq_time HHMM in UTC,
 * confidence, frp). `source` is the FIRMS source the CSV came from.
 */
export function parseFirmsCsv(csv: string, source: string): HotspotDetection[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = (header ?? '').split(',');
  const lat = columns.indexOf('latitude');
  const lon = columns.indexOf('longitude');
  const date = columns.indexOf('acq_date');
  const time = columns.indexOf('acq_time');
  const confidence = columns.indexOf('confidence');
  const frp = columns.indexOf('frp');
  if ([lat, lon, date, time].includes(-1)) {
    // FIRMS answers errors (e.g. "Invalid MAP_KEY.") as plain text with status 200.
    throw new Error(`Unexpected FIRMS response: ${csv.slice(0, 80)}`);
  }

  const hotspots: HotspotDetection[] = [];
  for (const line of lines) {
    const cells = line.split(',');
    const latitude = Number(cells[lat]);
    const longitude = Number(cells[lon]);
    const hhmm = (cells[time] ?? '').padStart(4, '0');
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !cells[date]) continue;
    hotspots.push({
      latitude,
      longitude,
      detectedAt: `${cells[date]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`,
      source,
      confidence: parseConfidence(confidence === -1 ? undefined : cells[confidence]),
      ...(frp !== -1 && Number.isFinite(Number(cells[frp])) && cells[frp] !== '' ? { frp: Number(cells[frp]) } : {}),
    });
  }
  return hotspots;
}

/** NASA FIRMS area API. Needs a free MAP_KEY: https://firms.modaps.eosdis.nasa.gov/api/map_key/ */
export class FirmsHotspotProvider implements HotspotProvider {
  constructor(
    private readonly mapKey: string,
    private readonly getText: TextGetter = axiosGetText,
  ) {}

  async fetchRecent(): Promise<HotspotDetection[]> {
    const results: HotspotDetection[] = [];
    for (const source of FIRMS_SOURCES) {
      results.push(...parseFirmsCsv(await this.getText(firmsAreaUrl(this.mapKey, source)), source));
    }
    return results;
  }
}
