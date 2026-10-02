import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { levelFromScore } from '../src/domain/model/RiskLevel.js';
import { firesPerYear } from '../src/domain/service/fireFrequency.js';
import { RiskScoringService, SCORE_WEIGHTS } from '../src/domain/service/RiskScoringService.js';

const service = new RiskScoringService();
const weather = (t: number, h: number, w: number, d: number) => ({
  zoneId: 'z',
  temperatureC: t,
  humidityPct: h,
  windKmh: w,
  daysWithoutRain: d,
});

describe('levelFromScore', () => {
  it('maps the thresholds', () => {
    assert.equal(levelFromScore(0), 'low');
    assert.equal(levelFromScore(24), 'low');
    assert.equal(levelFromScore(25), 'medium');
    assert.equal(levelFromScore(50), 'high');
    assert.equal(levelFromScore(75), 'extreme');
    assert.equal(levelFromScore(100), 'extreme');
  });
});

describe('RiskScoringService', () => {
  it('gives a low score for cold, wet weather without hotspots or history', () => {
    const result = service.assess({ weather: weather(12, 85, 5, 0), nearbyHotspotCount: 0, firesPerYear: 0 });
    assert.equal(result.level, 'low');
    assert.ok(result.score <= 10);
  });

  it('gives an extreme score for the worst case', () => {
    const result = service.assess({ weather: weather(35, 15, 45, 20), nearbyHotspotCount: 6, firesPerYear: 3 });
    assert.equal(result.score, 100);
    assert.equal(result.level, 'extreme');
  });

  it('keeps every factor between 0 and 100', () => {
    const { factors } = service.assess({ weather: weather(-5, 120, -3, -2), nearbyHotspotCount: -1, firesPerYear: -1 });
    for (const value of Object.values(factors)) {
      assert.ok(value >= 0 && value <= 100);
    }
  });

  it('raises the score when there are hotspots nearby', () => {
    const base = { weather: weather(24, 40, 18, 9), firesPerYear: 0.5 };
    const without = service.assess({ ...base, nearbyHotspotCount: 0 });
    const withHotspots = service.assess({ ...base, nearbyHotspotCount: 3 });
    assert.ok(withHotspots.score > without.score);
  });

  it('turns fires per year into the history factor: 1 per year = 100, capped', () => {
    const history = (rate: number) =>
      service.assess({ weather: weather(12, 85, 5, 0), nearbyHotspotCount: 0, firesPerYear: rate }).factors.fireHistory;
    assert.equal(history(0), 0);
    assert.equal(history(0.258), 26); // 2 fires in 7.75 years
    assert.equal(history(1), 100);
    assert.equal(history(2.5), 100);
  });

  it('adds at most 20 points for the history (its weight stays 0.2)', () => {
    assert.deepEqual(SCORE_WEIGHTS, { dryWeather: 0.5, nearbyHotspots: 0.3, fireHistory: 0.2 });
    const base = { weather: weather(26, 35, 15, 12), nearbyHotspotCount: 0 };
    const none = service.assess({ ...base, firesPerYear: 0 });
    const max = service.assess({ ...base, firesPerYear: 1 });
    assert.equal(max.score - none.score, 20);
  });
});

describe('firesPerYear', () => {
  const now = new Date('2027-01-01T00:00:00Z'); // 8 years after 2019-01-01

  it('averages the fires over the whole record', () => {
    const dates = ['2019-03-01', '2019-08-20', '2020-01-10', '2021-07-07', '2022-02-02', '2022-09-09', '2026-07-18', '2026-08-22'];
    assert.ok(Math.abs(firesPerYear(dates, '2019-01-01', now) - 1) < 0.001);
    assert.ok(Math.abs(firesPerYear(['2020-05-05', '2026-05-05'], '2019-01-01', now) - 0.25) < 0.001);
  });

  it('counts old fires the same as recent ones (no window)', () => {
    assert.equal(firesPerYear(['2019-01-02'], '2019-01-01', now), firesPerYear(['2026-12-30'], '2019-01-01', now));
  });

  it('ignores dates outside the record and is 0 without fires', () => {
    assert.equal(firesPerYear(['2018-12-31', '2027-02-01'], '2019-01-01', now), 0);
    assert.equal(firesPerYear([], '2019-01-01', now), 0);
    assert.equal(firesPerYear(['2019-05-05'], '2027-01-01', now), 0); // empty record
  });
});
