import type { RiskLevel, ZoneRiskSummary } from '../../../domain/model/risk';
import { RISK_LABELS } from '../../../domain/util/risk-labels';

/**
 * From this zoom on every marker shows the municipality name. Below it (the whole department fits
 * on screen and 64 names pile up) markers are only the colored dot with the score; the selected
 * one keeps its name.
 */
export const NAME_MIN_ZOOM = 10;

export function showsNames(zoom: number): boolean {
  return zoom >= NAME_MIN_ZOOM;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

/** Inner HTML of a Leaflet divIcon. Which parts show depends on CSS (map-markers.css). */
export function zoneMarkerHtml(zone: ZoneRiskSummary, selected: boolean): string {
  return (
    `<div class="zone-marker risk-${zone.level}${selected ? ' is-selected' : ''}">` +
    `<span class="zone-dot"><i>${zone.score}</i></span>` +
    `<span class="zone-label"><b>${escapeHtml(zone.name)}</b><small>${zone.score} · ${RISK_LABELS[zone.level]}</small></span>` +
    `</div>`
  );
}

/** A group of nearby seats at low zoom: how many, in the color of the worst one. Tapping it zooms in. */
export function clusterMarkerHtml(count: number, level: RiskLevel): string {
  return `<div class="zone-cluster risk-${level}"><b>${count}</b></div>`;
}

/** Spoken name of a group marker (it is a button for screen readers). */
export function clusterLabel(count: number): string {
  return `${count} municipios. Toca para acercar`;
}
