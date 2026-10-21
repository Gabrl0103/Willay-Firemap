import type { PathOptions } from 'leaflet';
import type { RiskLevel } from '../../../domain/model/risk';

/** Fill colors by level; the map reads them from the --risk-* tokens (theme/tokens.css). */
export type RiskColors = Readonly<Record<RiskLevel, string>>;

const LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high', 'extreme'];

export function readRiskColors(element: Element): RiskColors {
  const style = getComputedStyle(element);
  return Object.fromEntries(LEVELS.map((level) => [level, style.getPropertyValue(`--risk-${level}`).trim()])) as RiskColors;
}

/** Thin light outline shared by neighbours, so two risk colors never fight on the same edge. */
const OUTLINE = 'rgba(255, 243, 234, 0.4)';
/** Zones without a score yet (the weather has not arrived): the prototype's Nariño fill. */
const NO_RISK_FILL = '#35655c';

/**
 * Style of a municipal polygon: its risk color, translucent so the terrain and the markers on top
 * still read; the selected one is a bit stronger and has a wider white outline.
 */
export function zoneAreaStyle(level: RiskLevel | undefined, selected: boolean, colors: RiskColors): PathOptions {
  return {
    color: selected ? '#fff3ea' : OUTLINE,
    weight: selected ? 2 : 0.8,
    opacity: selected ? 0.9 : 1,
    fillColor: level ? colors[level] : NO_RISK_FILL,
    fillOpacity: level ? (selected ? 0.45 : 0.28) : 0.3,
  };
}
