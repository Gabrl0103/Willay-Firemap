import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OPEN_METEO_DAILY_VARIABLES, type OpenMeteoDay } from '../src/domain/model/RiskForecast.js';
import {
  MissingForecastDataError,
  addDays,
  buildFeatures,
  consecutiveDryDays,
  countHotspotsByDay,
  localDate,
  seasonFeatures,
  toPowerDay,
} from '../src/domain/service/forecastFeatures.js';
import { predictRisk } from '../src/domain/service/riskForecastModel.js';
import { RISK_MODEL } from '../src/infrastructure/ml/riskModel.js';
import cases from './fixtures/risk-model-cases.json' with { type: 'json' };

const TOLERANCE = 1e-9;

type DailyColumns = (typeof cases.features)[number]['openMeteoDaily'];

function openMeteoDays(daily: DailyColumns): OpenMeteoDay[] {
  return daily.date.map((date, i) => {
    const day: Record<string, number | string | null> = { date };
    for (const variable of OPEN_METEO_DAILY_VARIABLES) day[variable] = daily[variable][i] ?? null;
    return day as OpenMeteoDay;
  });
}

describe('buildFeatures (ml/willay_ml/features.py port)', () => {
  for (const testCase of cases.features) {
    it(`matches Python for ${testCase.zoneId} on ${testCase.date}`, () => {
      const features = buildFeatures(
        {
          zoneId: testCase.zoneId,
          date: testCase.date,
          weather: openMeteoDays(testCase.openMeteoDaily),
          hotspotsZone: testCase.hotspotsZoneDaily,
          hotspotsRing: testCase.hotspotsRingDaily,
        },
        RISK_MODEL,
      );
      for (const [name, expected] of Object.entries(testCase.features)) {
        const actual = features[name];
        assert.ok(actual !== undefined && Math.abs(actual - expected) < TOLERANCE * Math.max(1, Math.abs(expected)), `${name}: ${actual} vs ${expected}`);
      }
      const probability = predictRisk(features, RISK_MODEL).probability;
      assert.ok(Math.abs(probability - testCase.probability) < TOLERANCE, `${probability} vs ${testCase.probability}`);
    });
  }

  const sample = cases.features[0]!;
  const input = {
    zoneId: sample.zoneId,
    date: sample.date,
    weather: openMeteoDays(sample.openMeteoDaily),
    hotspotsZone: sample.hotspotsZoneDaily,
    hotspotsRing: sample.hotspotsRingDaily,
  };

  it('needs exactly 30 days of weather ending on the day', () => {
    assert.throws(() => buildFeatures({ ...input, weather: input.weather.slice(1) }, RISK_MODEL), MissingForecastDataError);
    assert.throws(() => buildFeatures({ ...input, date: addDays(input.date, 1) }, RISK_MODEL), MissingForecastDataError);
  });

  it('reports a missing weather value as missing weather', () => {
    const weather = input.weather.map((day, i) => (i === 10 ? { ...day, precipitation_sum: null } : day));
    assert.throws(
      () => buildFeatures({ ...input, weather }, RISK_MODEL),
      (error: unknown) => error instanceof MissingForecastDataError && error.kind === 'weather',
    );
  });

  it('reports missing hotspot days as missing hotspots', () => {
    assert.throws(
      () => buildFeatures({ ...input, hotspotsZone: input.hotspotsZone.slice(1) }, RISK_MODEL),
      (error: unknown) => error instanceof MissingForecastDataError && error.kind === 'hotspots',
    );
  });
});

describe('weather and calendar helpers', () => {
  it('maps Open-Meteo values to the POWER scale and clips them', () => {
    const day = openMeteoDays(cases.features[0]!.openMeteoDaily)[0]!;
    const rule = RISK_MODEL.weather.openMeteoToPower.precipitation_mm;
    const power = toPowerDay({ ...day, precipitation_sum: 10, relative_humidity_2m_mean: 1000 }, RISK_MODEL);
    assert.ok(Math.abs(power.precipitation_mm - (rule.slope * 10 + rule.intercept)) < TOLERANCE);
    assert.equal(power.humidity_mean_pct, 100);
  });

  it('counts dry days back from the last day', () => {
    assert.equal(consecutiveDryDays([5, 0, 0.5, 0.9], 1), 3);
    assert.equal(consecutiveDryDays([0, 0, 3], 1), 0);
  });

  it('puts 1 January at angle 0, like pandas dayofyear', () => {
    const january = seasonFeatures('2025-01-01');
    assert.ok(Math.abs(january.day_of_year_sin) < TOLERANCE);
    assert.ok(Math.abs(january.day_of_year_cos - 1) < TOLERANCE);
  });

  it('uses Colombian local days (UTC-5)', () => {
    assert.equal(localDate('2026-10-02T03:00:00Z', -5), '2026-10-01');
    assert.equal(localDate('2026-10-02T06:00:00Z', -5), '2026-10-02');
    assert.equal(addDays('2026-10-01', -30), '2026-09-01');
  });
});

describe('countHotspotsByDay', () => {
  const zone = { latitude: 1.5, longitude: -77.5 };
  const days = ['2026-10-01', '2026-10-02'];
  const at = (source: string, latitude: number, longitude: number, detectedAt: string) => ({ source, latitude, longitude, detectedAt });

  it('counts the zone (<= 25 km) and the ring (25-50 km) per local day, only with the model satellites', () => {
    const counts = countHotspotsByDay(
      [
        at('VIIRS_SNPP_NRT', 1.5, -77.5, '2026-10-01T18:00:00Z'), // zone, day 1
        at('VIIRS_NOAA20_NRT', 1.5, -77.5, '2026-10-01T18:30:00Z'), // same fire, other satellite: still counts
        at('VIIRS_NOAA21_NRT', 1.5, -77.5, '2026-10-01T18:20:00Z'), // NOAA-21 was not in the training
        at('VIIRS_SNPP_NRT', 1.8, -77.5, '2026-10-02T03:00:00Z'), // ~33 km: ring, still day 1 in Colombia
        at('VIIRS_SNPP_NRT', 2.2, -77.5, '2026-10-02T18:00:00Z'), // ~78 km: outside
        at('VIIRS_SNPP_NRT', 1.5, -77.5, '2026-09-30T18:00:00Z'), // another day
      ],
      zone,
      days,
      RISK_MODEL,
    );
    assert.deepEqual(counts, { zone: [2, 0], ring: [1, 0] });
  });

  it('drops detections next to a static source (volcano, industry)', () => {
    const [latitude, longitude] = RISK_MODEL.hotspots.staticSources[0]!;
    const counts = countHotspotsByDay(
      [at('VIIRS_SNPP_NRT', latitude, longitude, '2026-10-01T18:00:00Z')],
      { latitude, longitude },
      days,
      RISK_MODEL,
    );
    assert.deepEqual(counts, { zone: [0, 0], ring: [0, 0] });
  });
});
