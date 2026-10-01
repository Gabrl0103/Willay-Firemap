import axios from 'axios';
import type { NewHotspot } from '../../domain/model/Hotspot.js';
import type { HotspotProvider } from '../../domain/port/DataSources.js';

const FIRMS_AREA_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
/** Nariño bounding box: west, south, east, north. */
const NARINO_BBOX = '-79.1,0.35,-76.8,2.7';
/** Near-real-time VIIRS satellites (375 m). */
const SATELLITES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'] as const;
const DAY_RANGE = 2;

/** Parses the FIRMS area CSV (latitude, longitude, acq_date YYYY-MM-DD, acq_time HHMM in UTC). */
export function parseFirmsCsv(csv: string): NewHotspot[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = (header ?? '').split(',');
  const lat = columns.indexOf('latitude');
  const lon = columns.indexOf('longitude');
  const date = columns.indexOf('acq_date');
  const time = columns.indexOf('acq_time');
  if ([lat, lon, date, time].includes(-1)) {
    // FIRMS answers errors (e.g. "Invalid MAP_KEY.") as plain text with status 200.
    throw new Error(`Unexpected FIRMS response: ${csv.slice(0, 80)}`);
  }

  const hotspots: NewHotspot[] = [];
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
    });
  }
  return hotspots;
}

/** NASA FIRMS area API. Needs a free MAP_KEY: https://firms.modaps.eosdis.nasa.gov/api/map_key/ */
export class FirmsHotspotProvider implements HotspotProvider {
  constructor(private readonly mapKey: string) {}

  async fetchRecent(): Promise<NewHotspot[]> {
    const results: NewHotspot[] = [];
    for (const satellite of SATELLITES) {
      const { data } = await axios.get<string>(
        `${FIRMS_AREA_URL}/${this.mapKey}/${satellite}/${NARINO_BBOX}/${DAY_RANGE}`,
        { timeout: 30_000, responseType: 'text' },
      );
      results.push(...parseFirmsCsv(data));
    }
    return results;
  }
}
