import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { daysWithoutRain, toWeatherSnapshot } from '../src/infrastructure/external/OpenMeteoWeatherProvider.js';

describe('daysWithoutRain', () => {
  it('counts dry days back from the most recent one', () => {
    assert.equal(daysWithoutRain([5, 0, 0.4, 0, null]), 4);
  });

  it('is 0 when it rained on the last day', () => {
    assert.equal(daysWithoutRain([0, 0, 12]), 0);
  });

  it('counts every day when it never rained', () => {
    assert.equal(daysWithoutRain([0, 0, 0]), 3);
  });
});

describe('toWeatherSnapshot', () => {
  it('maps an Open-Meteo location to a snapshot', () => {
    const snapshot = toWeatherSnapshot('pasto', {
      current: { temperature_2m: 13.24, relative_humidity_2m: 92.6, wind_speed_10m: 0.64 },
      daily: { precipitation_sum: [10, 0, 0] },
    });
    assert.deepEqual(snapshot, { zoneId: 'pasto', temperatureC: 13.2, humidityPct: 93, windKmh: 0.6, daysWithoutRain: 2 });
  });

  it('rejects a location without data', () => {
    assert.throws(() => toWeatherSnapshot('pasto', {}));
  });
});
