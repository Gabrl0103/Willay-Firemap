import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FIRMS_DAY_RANGE,
  FIRMS_SOURCES,
  FirmsHotspotProvider,
  parseConfidence,
  parseFirmsCsv,
} from '../src/infrastructure/external/FirmsHotspotProvider.js';

describe('parseFirmsCsv', () => {
  it('reads coordinates, the UTC detection time, confidence and FRP', () => {
    const csv =
      'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n' +
      '0.49498,-77.87077,330.1,0.4,0.4,2026-09-30,1853,N,VIIRS,n,2.0NRT,290.1,8.57,D\n' +
      '0.8812,-77.6012,331.2,0.4,0.4,2026-09-27,605,N,VIIRS,h,2.0NRT,288.4,,N\n';
    assert.deepEqual(parseFirmsCsv(csv, 'VIIRS_SNPP_NRT'), [
      {
        latitude: 0.49498,
        longitude: -77.87077,
        detectedAt: '2026-09-30T18:53:00Z',
        source: 'VIIRS_SNPP_NRT',
        confidence: 'nominal',
        frp: 8.57,
      },
      { latitude: 0.8812, longitude: -77.6012, detectedAt: '2026-09-27T06:05:00Z', source: 'VIIRS_SNPP_NRT', confidence: 'high' },
    ]);
  });

  it('maps VIIRS and MODIS confidence values', () => {
    assert.deepEqual(['l', 'n', 'h', 'low', 'HIGH', '85', '50', '10', '', undefined].map(parseConfidence), [
      'low', 'nominal', 'high', 'low', 'high', 'high', 'nominal', 'low', 'nominal', 'nominal',
    ]);
  });

  it('returns no hotspots for a header-only answer', () => {
    assert.deepEqual(parseFirmsCsv('latitude,longitude,acq_date,acq_time\n', 'VIIRS_SNPP_NRT'), []);
  });

  it('fails on a FIRMS error message', () => {
    assert.throws(() => parseFirmsCsv('Invalid MAP_KEY.', 'VIIRS_SNPP_NRT'), /Unexpected FIRMS response/);
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
    assert.deepEqual(hotspots, [
      { latitude: 0.4475, longitude: -77.887, detectedAt: '2026-10-01T06:31:00Z', source: 'VIIRS_NOAA21_NRT', confidence: 'nominal' },
    ]);
  });

  it('reads the empty answer FIRMS gives (header without a final newline)', () => {
    const header =
      'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight';
    assert.deepEqual(parseFirmsCsv(header, 'VIIRS_NOAA21_NRT'), []);
  });
});
