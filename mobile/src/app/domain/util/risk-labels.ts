import type { FireSource, RiskLevel } from '../model/risk';

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  extreme: 'Extremo',
};

/** Score range of each level, as levelFromScore (department-summary.ts) cuts them. */
export const RISK_RANGES: Record<RiskLevel, string> = {
  low: '0–24',
  medium: '25–49',
  high: '50–74',
  extreme: '75–100',
};

export const SOURCE_LABELS: Record<FireSource, string> = {
  news: 'Noticias',
  ungrd: 'UNGRD',
};
