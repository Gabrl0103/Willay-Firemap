import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IngestDailyWeatherUseCase } from '../src/application/useCase/IngestDailyWeatherUseCase.js';
import { IngestHotspotHistoryUseCase } from '../src/application/useCase/IngestHotspotHistoryUseCase.js';
import { IngestHotspotsUseCase, completeUtcDays } from '../src/application/useCase/IngestHotspotsUseCase.js';
import type { DailyWeather } from '../src/domain/model/DailyWeather.js';
import type { HotspotDetection } from '../src/domain/model/Hotspot.js';
import { firmsAreaUrlFrom } from '../src/infrastructure/external/FirmsHotspotProvider.js';
import { toOpenMeteoDays } from '../src/infrastructure/external/OpenMeteoArchiveProvider.js';
import {
  InMemoryDailyWeatherRepository,
  InMemoryHotspotDetectionRepository,
  InMemoryHotspotRepository,
  InMemoryZoneRepository,
} from '../src/infrastructure/persistence/InMemoryRepositories.js';
import { zones } from '../src/infrastructure/persistence/seedData.js';

const detection = (overrides: Partial<HotspotDetection> = {}): HotspotDetection => ({
  latitude: 1.2,
  longitude: -77.3,
  detectedAt: '2026-10-17T18:00:00Z',
  source: 'VIIRS_SNPP_NRT',
  confidence: 'nominal',
  ...overrides,
});

const day = (zoneId: string, date: string): DailyWeather => ({
  zoneId,
  date,
  source: 'archive',
  precipitation_sum: 1,
  temperature_2m_mean: 15,
  temperature_2m_max: 20,
  temperature_2m_min: 10,
  relative_humidity_2m_mean: 80,
  wind_speed_10m_max: 8,
  wind_speed_10m_mean: 3,
  et0_fao_evapotranspiration: 3,
});

describe('IngestHotspotsUseCase keeps the raw detections for the forecast', () => {
  it('stores every satellite detection and marks the complete UTC days', async () => {
    const detections = new InMemoryHotspotDetectionRepository([detection({ detectedAt: '2026-08-01T18:00:00Z' })]);
    const sameFire = [
      detection(),
      detection({ source: 'VIIRS_NOAA20_NRT', detectedAt: '2026-10-17T18:40:00Z' }),
      detection({ source: 'VIIRS_NOAA21_NRT', detectedAt: '2026-10-17T18:20:00Z' }),
    ];
    const useCase = new IngestHotspotsUseCase(
      { fetchRecent: async () => sameFire },
      new InMemoryHotspotRepository([]),
      detections,
    );

    const result = await useCase.execute(new Date('2026-10-18T12:00:00Z'));
    assert.deepEqual(result, { detected: 3, stored: 1 }); // the map keeps one fire...
    assert.equal((await detections.findSince('2026-01-01T00:00:00Z')).length, 3); // ...the model all passes
    assert.deepEqual(await detections.findCompleteDays('2026-01-01'), ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
  });

  it('counts as complete every UTC day of the window except today', () => {
    assert.deepEqual(completeUtcDays(new Date('2026-10-01T02:00:00Z'), 5), ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']);
  });

  it('drops what is older than 35 days', async () => {
    const detections = new InMemoryHotspotDetectionRepository([detection({ detectedAt: '2026-09-01T18:00:00Z' })], ['2026-09-01']);
    await new IngestHotspotsUseCase({ fetchRecent: async () => [] }, new InMemoryHotspotRepository([]), detections).execute(
      new Date('2026-10-18T12:00:00Z'),
    );
    assert.deepEqual(await detections.findSince('2026-01-01T00:00:00Z'), []);
    assert.equal((await detections.findCompleteDays('2026-01-01')).includes('2026-09-01'), false);
  });
});

describe('IngestHotspotHistoryUseCase', () => {
  it('loads the last 35 UTC days in 5-day FIRMS requests and marks them complete', async () => {
    const requests: string[] = [];
    const detections = new InMemoryHotspotDetectionRepository();
    const useCase = new IngestHotspotHistoryUseCase(
      {
        fetchDays: async (start, days) => {
          requests.push(`${start}+${days}`);
          return [detection({ detectedAt: `${start}T18:00:00Z` })];
        },
      },
      detections,
    );

    assert.equal(await useCase.execute(new Date('2026-10-18T12:00:00Z')), 7);
    assert.deepEqual(requests, [
      '2026-09-13+5', '2026-09-18+5', '2026-09-23+5', '2026-09-28+5', '2026-10-03+5', '2026-10-08+5', '2026-10-13+5',
    ]);
    const complete = await detections.findCompleteDays('2026-01-01');
    assert.equal(complete.length, 35);
    assert.equal(complete[0], '2026-09-13');
    assert.equal(complete[complete.length - 1], '2026-10-17');
  });

  it('asks FIRMS from a start date', () => {
    assert.equal(
      firmsAreaUrlFrom('KEY', 'VIIRS_SNPP_NRT', '2026-09-13', 5),
      'https://firms.modaps.eosdis.nasa.gov/api/area/csv/KEY/VIIRS_SNPP_NRT/-79.1,0.35,-76.8,2.7/5/2026-09-13',
    );
  });
});

describe('IngestDailyWeatherUseCase', () => {
  it('asks for the 35 local days up to yesterday and drops older ones', async () => {
    const asked: string[] = [];
    const repository = new InMemoryDailyWeatherRepository([day('pasto', '2026-09-01')]);
    const useCase = new IngestDailyWeatherUseCase(
      new InMemoryZoneRepository(zones.slice(0, 2)),
      {
        fetchDaily: async (requested, from, to) => {
          asked.push(`${requested.length} zones ${from}..${to}`);
          return requested.map((zone) => day(zone.id, to));
        },
      },
      repository,
    );

    // 03:00 UTC on the 19th is still the 18th in Colombia.
    assert.equal(await useCase.execute(new Date('2026-10-19T03:00:00Z')), 2);
    assert.deepEqual(asked, ['2 zones 2026-09-13..2026-10-17']);
    assert.deepEqual(await repository.findRange('pasto', '2026-01-01', '2026-12-31'), [day('pasto', '2026-10-17')]);
  });

  it('replaces a stored day and returns days oldest first', async () => {
    const repository = new InMemoryDailyWeatherRepository();
    await repository.upsertMany([day('pasto', '2026-10-02'), day('pasto', '2026-10-01')], '2026-09-01');
    await repository.upsertMany([{ ...day('pasto', '2026-10-02'), precipitation_sum: 9 }], '2026-09-01');
    const stored = await repository.findRange('pasto', '2026-10-01', '2026-10-02');
    assert.deepEqual(stored.map((d) => [d.date, d.precipitation_sum]), [['2026-10-01', 1], ['2026-10-02', 9]]);
  });
});

describe('toOpenMeteoDays', () => {
  it('turns the daily arrays into one day per date, with null for missing values', () => {
    const days = toOpenMeteoDays({
      daily: { time: ['2026-10-17', '2026-10-18'], precipitation_sum: [2.7, null], temperature_2m_mean: [14.9, 14.4] },
    });
    assert.equal(days.length, 2);
    assert.equal(days[0]!.precipitation_sum, 2.7);
    assert.equal(days[1]!.precipitation_sum, null);
    assert.equal(days[1]!.wind_speed_10m_max, null);
  });

  it('rejects an answer without daily data', () => {
    assert.throws(() => toOpenMeteoDays({}));
  });
});
