import type { RiskLevel, ZoneRiskSummary } from '../../../domain/model/risk';
import { RISK_LABELS } from '../../../domain/util/risk-labels';

/**
 * From this zoom on markers show the municipality name and score, as long as their label does not
 * run into another one (visibleLabels). Below it markers are only the colored dot with the score;
 * the selected one keeps its name.
 */
export const NAME_MIN_ZOOM = 8.5;

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

/** Where a marker's label sits on screen (px) and how much it matters: the higher, the sooner it shows. */
export interface LabelBox {
  readonly key: string;
  readonly priority: number;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Room (px) kept between two labels. */
const LABEL_GAP = 2;

const overlaps = (a: LabelBox, b: LabelBox): boolean =>
  a.left < b.right + LABEL_GAP && b.left < a.right + LABEL_GAP && a.top < b.bottom + LABEL_GAP && b.top < a.bottom + LABEL_GAP;

/**
 * The labels that fit without overlapping, from the highest priority down (the selected zone, then
 * the riskiest): a label that would run into one already placed stays hidden.
 */
export function visibleLabels(boxes: readonly LabelBox[]): Set<string> {
  const placed: LabelBox[] = [];
  for (const box of [...boxes].sort((a, b) => b.priority - a.priority)) {
    if (!placed.some((other) => overlaps(other, box))) placed.push(box);
  }
  return new Set(placed.map((box) => box.key));
}

/** A group of nearby seats at low zoom: how many, in the color of the worst one. Tapping it zooms in. */
export function clusterMarkerHtml(count: number, level: RiskLevel): string {
  return `<div class="zone-cluster risk-${level}"><b>${count}</b></div>`;
}

/** Spoken name of a group marker (it is a button for screen readers). */
export function clusterLabel(count: number): string {
  return `${count} municipios. Toca para acercar`;
}
