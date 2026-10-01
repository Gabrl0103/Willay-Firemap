import type { FireSource, RiskLevel } from '../model/risk';

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  extreme: 'Extremo',
};

export const SOURCE_LABELS: Record<FireSource, string> = {
  news: 'Noticias',
  ungrd: 'UNGRD',
};
