import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { levelFromScore } from '../src/domain/model/RiskLevel.js';
import { RiskScoringService } from '../src/domain/service/RiskScoringService.js';

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
    const result = service.assess({ weather: weather(12, 85, 5, 0), nearbyHotspotCount: 0, recentFireCount: 0 });
    assert.equal(result.level, 'low');
    assert.ok(result.score <= 10);
  });

  it('gives an extreme score for the worst case', () => {
    const result = service.assess({ weather: weather(35, 15, 45, 20), nearbyHotspotCount: 6, recentFireCount: 9 });
    assert.equal(result.score, 100);
    assert.equal(result.level, 'extreme');
  });

  it('keeps every factor between 0 and 100', () => {
    const { factors } = service.assess({ weather: weather(-5, 120, -3, -2), nearbyHotspotCount: -1, recentFireCount: 0 });
    for (const value of Object.values(factors)) {
      assert.ok(value >= 0 && value <= 100);
    }
  });

  it('raises the score when there are hotspots nearby', () => {
    const base = { weather: weather(24, 40, 18, 9), recentFireCount: 1 };
    const without = service.assess({ ...base, nearbyHotspotCount: 0 });
    const withHotspots = service.assess({ ...base, nearbyHotspotCount: 3 });
    assert.ok(withHotspots.score > without.score);
  });
});
