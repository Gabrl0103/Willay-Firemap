import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ZoneRiskCalculator } from '../src/application/service/ZoneRiskCalculator.js';
import type { Hotspot } from '../src/domain/model/Hotspot.js';
import {
  HOTSPOT_FULL_WEIGHT_DAYS,
  HOTSPOT_WINDOW_DAYS,
  hotspotAgeDays,
  hotspotWeight,
} from '../src/domain/service/hotspotRecency.js';
import { RiskScoringService } from '../src/domain/service/RiskScoringService.js';

const now = new Date('2026-10-04T12:00:00Z');
const hoursAgo = (hours: number): string => new Date(now.getTime() - hours * 3_600_000).toISOString();

describe('hotspotWeight', () => {
  it('keeps the old 2-day window at full weight inside the new 5-day window', () => {
    assert.equal(HOTSPOT_FULL_WEIGHT_DAYS, 2);
    assert.equal(HOTSPOT_WINDOW_DAYS, 5);
    assert.equal(hotspotWeight(hoursAgo(1), now), 1);
    assert.equal(hotspotWeight(hoursAgo(48), now), 1);
  });

  it('fades out linearly between 2 and 5 days', () => {
    assert.equal(hotspotWeight(hoursAgo(72), now), 2 / 3);
    assert.equal(hotspotWeight(hoursAgo(96), now), 1 / 3);
    assert.equal(hotspotWeight(hoursAgo(120), now), 0);
    assert.equal(hotspotWeight(hoursAgo(200), now), 0);
  });

  it('counts a detection from the future as recent and ignores a bad date', () => {
    assert.equal(hotspotWeight(hoursAgo(-2), now), 1);
    assert.equal(hotspotWeight('not a date', now), 0);
    assert.ok(Number.isNaN(hotspotAgeDays('not a date', now)));
  });
});

describe('ZoneRiskCalculator hotspots', () => {
  const zone = { id: 'pasto', name: 'Pasto', latitude: 1.2124, longitude: -77.2788 };
  const weather = { zoneId: 'pasto', temperatureC: 12, humidityPct: 85, windKmh: 5, daysWithoutRain: 0 };
  const calculatorWith = (hotspots: Hotspot[]) =>
    new ZoneRiskCalculator(
      { findByZoneId: async () => weather, findAll: async () => [weather], saveMany: async () => 0 } as never,
      { findAll: async () => [] } as never,
      { findAll: async () => hotspots } as never,
      new RiskScoringService(),
    );

  it('weights nearby hotspots by age and reports the newest one', async () => {
    const result = await calculatorWith([
      { id: 'a', latitude: 1.25, longitude: -77.3, detectedAt: hoursAgo(10) }, // 1
      { id: 'b', latitude: 1.26, longitude: -77.31, detectedAt: hoursAgo(72) }, // 2/3
      { id: 'c', latitude: 1.2, longitude: -77.25, detectedAt: hoursAgo(96) }, // 1/3
      { id: 'far', latitude: 2.5, longitude: -78.8, detectedAt: hoursAgo(1) }, // > 25 km
    ]).calculate(zone, now);

    assert.equal(result.assessment.factors.nearbyHotspots, 67); // 2 weighted hotspots of 3
    assert.deepEqual(result.nearbyHotspots, { count: 3, latestDetectedAt: hoursAgo(10) });
  });

  it('gives the same factor as before for detections of the last 2 days', async () => {
    const recent = [1, 20, 40].map((h, i) => ({ id: `r${i}`, latitude: 1.22, longitude: -77.28, detectedAt: hoursAgo(h) }));
    const result = await calculatorWith(recent).calculate(zone, now);
    assert.equal(result.assessment.factors.nearbyHotspots, 100); // 3 or more = 100, as with the 2-day window
  });

  it('reports no hotspots when there are none nearby', async () => {
    const result = await calculatorWith([]).calculate(zone, now);
    assert.equal(result.assessment.factors.nearbyHotspots, 0);
    assert.deepEqual(result.nearbyHotspots, { count: 0, latestDetectedAt: null });
  });
});
