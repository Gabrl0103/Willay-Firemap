import type { RiskLevel, ZoneForecast } from '../model/risk';
import { formatDateTime, percentLabel } from './format';
import { RISK_LABELS } from './risk-labels';

/** Day at whose end each forecast row starts its 72 h (as «Pronóstico 72 h» says it). */
const WHEN: Record<24 | 48 | 72, string> = { 24: 'hoy', 48: 'mañana', 72: 'pasado mañana' };

export const SHARE_DISCLAIMER = 'Estimación de riesgo, no predicción exacta.';
export const SHARE_SIGNATURE = 'Atalaya · Riesgo de incendios en Nariño';

export interface ShareableZone {
  readonly name: string;
  readonly score: number;
  readonly level: RiskLevel;
}

/**
 * What «Compartir» sends for a zone, with the data on screen right now. The 72 h rows go only when
 * the model answered (not its fallback, not while loading or after a failure). Nothing about the
 * user nor links to the API.
 */
export function shareText(zone: ShareableZone, forecast: ZoneForecast | null, updatedAt: Date | null): string {
  const lines = [`${zone.name}: riesgo de incendio ${RISK_LABELS[zone.level]} (${zone.score} de 100).`];
  if (forecast?.source === 'model' && forecast.horizons.length > 0) {
    lines.push('Pronóstico 72 h:');
    for (const horizon of forecast.horizons) {
      lines.push(`• ${horizon.hours} h (${WHEN[horizon.hours]}): ${RISK_LABELS[horizon.level]}, ${percentLabel(horizon.probability)}`);
    }
  }
  if (updatedAt) lines.push(`Actualizado: ${formatDateTime(updatedAt)}`);
  lines.push(SHARE_DISCLAIMER, '', SHARE_SIGNATURE);
  return lines.join('\n');
}
