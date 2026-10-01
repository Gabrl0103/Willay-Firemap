export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

/** Score 0-100 -> level. Bajo 0-24, Medio 25-49, Alto 50-74, Extremo 75-100. */
export function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'extreme';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}
