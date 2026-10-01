import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFirmsCsv } from '../src/infrastructure/external/FirmsHotspotProvider.js';

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
