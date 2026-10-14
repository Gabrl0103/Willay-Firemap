import type { Hotspot, ZoneRiskSummary } from '../model/risk';
import { levelFromScore, summarizeDepartment, topZones } from './department-summary';

function zone(id: string, score: number): ZoneRiskSummary {
  return { id, name: id, latitude: 1, longitude: -77, score, level: levelFromScore(score) };
}

const HOTSPOT: Hotspot = { id: 'h1', latitude: 1, longitude: -77, detectedAt: '2026-10-05T10:00:00Z' };

describe('department summary', () => {
  it('maps scores to levels with the backend thresholds', () => {
    expect(levelFromScore(24)).toBe('low');
    expect(levelFromScore(25)).toBe('medium');
    expect(levelFromScore(50)).toBe('high');
    expect(levelFromScore(75)).toBe('extreme');
  });

  it('averages zone scores and counts zones and hotspots', () => {
    const summary = summarizeDepartment([zone('a', 20), zone('b', 31), zone('c', 55)], [HOTSPOT, HOTSPOT]);
    expect(summary).toEqual({ averageScore: 35, level: 'medium', hotspotCount: 2, zoneCount: 3 });
  });

  it('has no summary without zones', () => {
    expect(summarizeDepartment([], [HOTSPOT])).toBeNull();
  });

  it('picks the highest scores first without mutating the input', () => {
    const zones = [zone('a', 20), zone('b', 62), zone('c', 48)];
    expect(topZones(zones, 2).map((z) => z.id)).toEqual(['b', 'c']);
    expect(zones.map((z) => z.id)).toEqual(['a', 'b', 'c']);
  });
});
