import type { Hotspot, RiskLevel, ZoneRiskSummary } from '../model/risk';

/** Score 0-100 -> level. Same thresholds as the backend: Bajo 0-24, Medio 25-49, Alto 50-74, Extremo 75-100. */
export function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'extreme';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export interface DepartmentSummary {
  readonly averageScore: number;
  readonly level: RiskLevel;
  /** FIRMS detections over Nariño; the API keeps only the last 5 days. */
  readonly hotspotCount: number;
  readonly zoneCount: number;
}

/** Department-wide numbers for the home screen. Null while there are no zones to average. */
export function summarizeDepartment(
  zones: readonly ZoneRiskSummary[],
  hotspots: readonly Hotspot[],
): DepartmentSummary | null {
  if (zones.length === 0) return null;
  const averageScore = Math.round(zones.reduce((sum, zone) => sum + zone.score, 0) / zones.length);
  return { averageScore, level: levelFromScore(averageScore), hotspotCount: hotspots.length, zoneCount: zones.length };
}

/** The `count` zones with the highest score, highest first. */
export function topZones(zones: readonly ZoneRiskSummary[], count: number): ZoneRiskSummary[] {
  return [...zones].sort((a, b) => b.score - a.score).slice(0, count);
}
