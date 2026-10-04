import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FIRMS_DAY_RANGE,
  FIRMS_SOURCES,
  FirmsHotspotProvider,
  parseFirmsCsv,
} from '../src/infrastructure/external/FirmsHotspotProvider.js';

describe('parseFirmsCsv', () => {
  it('reads coordinates and the UTC detection time', () => {
    const csv =
      'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite\n' +
      '1.2551,-77.3012,330.1,0.4,0.4,2026-09-29,1420,N\n' +
      '0.8812,-77.6012,331.2,0.4,0.4,2026-09-27,605,N\n';
    assert.deepEqual(parseFirmsCsv(csv), [
      { latitude: 1.2551, longitude: -77.3012, detectedAt: '2026-09-29T14:20:00Z' },
      { latitude: 0.8812, longitude: -77.6012, detectedAt: '2026-09-27T06:05:00Z' },
    ]);
  });

  it('returns no hotspots for a header-only answer', () => {
    assert.deepEqual(parseFirmsCsv('latitude,longitude,acq_date,acq_time\n'), []);
  });

  it('fails on a FIRMS error message', () => {
    assert.throws(() => parseFirmsCsv('Invalid MAP_KEY.'), /Unexpected FIRMS response/);
  });
});

describe('FirmsHotspotProvider', () => {
  it('asks the three VIIRS NRT sources for the last 5 days over Nariño', async () => {
    const urls: string[] = [];
    const provider = new FirmsHotspotProvider('KEY', async (url) => {
      urls.push(url);
      return url.includes('NOAA21')
        ? 'latitude,longitude,acq_date,acq_time\n0.4475,-77.887,2026-10-01,631'
        : 'latitude,longitude,acq_date,acq_time';
    });

    const hotspots = await provider.fetchRecent();

    assert.deepEqual(FIRMS_SOURCES, ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT']);
    assert.equal(FIRMS_DAY_RANGE, 5);
    assert.deepEqual(urls, [
      'https://firms.modaps.eosdis.nasa.gov/api/area/csv/KEY/VIIRS_SNPP_NRT/-79.1,0.35,-76.8,2.7/5',
      'https://firms.modaps.eosdis.nasa.gov/api/area/csv/KEY/VIIRS_NOAA20_NRT/-79.1,0.35,-76.8,2.7/5',
      'https://firms.modaps.eosdis.nasa.gov/api/area/csv/KEY/VIIRS_NOAA21_NRT/-79.1,0.35,-76.8,2.7/5',
    ]);
    assert.deepEqual(hotspots, [{ latitude: 0.4475, longitude: -77.887, detectedAt: '2026-10-01T06:31:00Z' }]);
  });

  it('reads the empty answer FIRMS gives (header without a final newline)', () => {
    const header =
      'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight';
    assert.deepEqual(parseFirmsCsv(header), []);
  });
});
