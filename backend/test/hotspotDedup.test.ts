import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IngestHotspotsUseCase } from '../src/application/useCase/IngestHotspotsUseCase.js';
import type { HotspotDetection, NewHotspot } from '../src/domain/model/Hotspot.js';
import { dedupeAcrossSatellites, isSameHotspot } from '../src/domain/service/hotspotDedup.js';

const detection = (overrides: Partial<HotspotDetection>): HotspotDetection => ({
  latitude: 0.49498,
  longitude: -77.87077,
  detectedAt: '2026-09-30T18:53:00Z',
  source: 'VIIRS_SNPP_NRT',
  confidence: 'nominal',
  ...overrides,
});

describe('isSameHotspot', () => {
  const snpp = detection({});

  it('matches another satellite within 1 km and 3 hours', () => {
    // Real pair of 2026-09-30: SNPP 18:53 and NOAA-21 18:15, about 10 m apart.
    const noaa21 = detection({ source: 'VIIRS_NOAA21_NRT', latitude: 0.49491, longitude: -77.87075, detectedAt: '2026-09-30T18:15:00Z' });
    assert.equal(isSameHotspot(snpp, noaa21), true);
  });

  it('keeps the limits inclusive: 3 hours apart still matches, 3 h 1 min does not', () => {
    assert.equal(isSameHotspot(snpp, detection({ source: 'VIIRS_NOAA20_NRT', detectedAt: '2026-09-30T21:53:00Z' })), true);
    assert.equal(isSameHotspot(snpp, detection({ source: 'VIIRS_NOAA20_NRT', detectedAt: '2026-09-30T21:54:00Z' })), false);
  });

  it('does not match beyond 1 km', () => {
    // 0.01° of latitude is about 1.1 km.
    assert.equal(isSameHotspot(snpp, detection({ source: 'VIIRS_NOAA20_NRT', latitude: 0.50498 })), false);
    assert.equal(isSameHotspot(snpp, detection({ source: 'VIIRS_NOAA20_NRT', latitude: 0.50298 })), true); // ~0.9 km
  });

  it('never merges pixels of the same satellite', () => {
    assert.equal(isSameHotspot(snpp, detection({ latitude: 0.4952 })), false);
  });
});

describe('dedupeAcrossSatellites', () => {
  it('keeps the most confident detection of a fire seen by three satellites', () => {
    const low = detection({ source: 'VIIRS_SNPP_NRT', confidence: 'low', frp: 30 });
    const high = detection({ source: 'VIIRS_NOAA20_NRT', confidence: 'high', frp: 2, detectedAt: '2026-09-30T18:00:00Z' });
    const nominal = detection({ source: 'VIIRS_NOAA21_NRT', confidence: 'nominal', detectedAt: '2026-09-30T19:30:00Z' });
    assert.deepEqual(dedupeAcrossSatellites([low, high, nominal]), [high]);
  });

  it('breaks confidence ties with the higher FRP, then the earliest detection', () => {
    const snpp = detection({ frp: 8.57 });
    const noaa21 = detection({ source: 'VIIRS_NOAA21_NRT', frp: 14.66, detectedAt: '2026-09-30T18:15:00Z' });
    assert.deepEqual(dedupeAcrossSatellites([snpp, noaa21]), [noaa21]);

    const early = detection({ source: 'VIIRS_NOAA20_NRT', detectedAt: '2026-09-30T18:00:00Z' });
    assert.deepEqual(dedupeAcrossSatellites([detection({}), early]), [early]);
  });

  it('keeps separate fires, neighbouring pixels of one pass and the input order', () => {
    const pixelA = detection({ source: 'VIIRS_NOAA20_NRT', latitude: 0.44745, longitude: -77.887, detectedAt: '2026-09-30T06:31:00Z' });
    const pixelB = detection({ source: 'VIIRS_NOAA20_NRT', latitude: 0.44754, longitude: -77.88618, detectedAt: '2026-09-30T06:31:00Z' });
    const elsewhere = detection({ latitude: 1.70143, longitude: -77.12056 });
    const later = detection({ source: 'VIIRS_NOAA21_NRT', latitude: 0.4475, longitude: -77.887, detectedAt: '2026-10-01T18:00:00Z' });
    assert.deepEqual(dedupeAcrossSatellites([elsewhere, pixelA, pixelB, later]), [elsewhere, pixelA, pixelB, later]);
  });
});

describe('IngestHotspotsUseCase', () => {
  it('stores the hotspots without satellite duplicates and reports both counts', async () => {
    const stored: NewHotspot[][] = [];
    const useCase = new IngestHotspotsUseCase(
      {
        fetchRecent: async () => [
          detection({ frp: 8.57 }),
          detection({ source: 'VIIRS_NOAA21_NRT', latitude: 0.49491, longitude: -77.87075, detectedAt: '2026-09-30T18:15:00Z', frp: 14.66 }),
          detection({ latitude: 1.70143, longitude: -77.12056 }),
        ],
      },
      { findAll: async () => [], replaceAll: async (hotspots) => void stored.push([...hotspots]) },
    );

    assert.deepEqual(await useCase.execute(), { detected: 3, stored: 2 });
    assert.deepEqual(stored[0], [
      { latitude: 0.49491, longitude: -77.87075, detectedAt: '2026-09-30T18:15:00Z' },
      { latitude: 1.70143, longitude: -77.12056, detectedAt: '2026-09-30T18:53:00Z' },
    ]);
  });
});
