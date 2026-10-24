import type { ZoneRiskSummary } from '../../../domain/model/risk';
import {
  NAME_MIN_ZOOM, clusterLabel, clusterMarkerHtml, coveredDots, showsNames, visibleLabels, zoneMarkerHtml, type LabelBox,
} from './zone-marker';

const zone = (name: string): ZoneRiskSummary => ({
  id: 'x', name, latitude: 1, longitude: -77, score: 63, level: 'high',
});

describe('zone marker', () => {
  it('shows names only from the name zoom on', () => {
    expect(showsNames(7.5)).toBe(false);
    expect(showsNames(NAME_MIN_ZOOM - 0.25)).toBe(false);
    expect(showsNames(NAME_MIN_ZOOM)).toBe(true);
    expect(showsNames(13)).toBe(true);
  });

  it('puts the score in the dot and the name in the label', () => {
    const html = zoneMarkerHtml(zone('Chachagüí'), false);
    expect(html).toContain('class="zone-marker risk-high"');
    expect(html).toContain('<span class="zone-dot"><i>63</i></span>');
    expect(html).toContain('<b>Chachagüí</b><small>63 · Alto</small>');
  });

  it('marks the selected zone, whose name is always shown', () => {
    expect(zoneMarkerHtml(zone('Pasto'), true)).toContain('class="zone-marker risk-high is-selected"');
  });

  it('escapes the name', () => {
    expect(zoneMarkerHtml(zone('<img src=x>'), false)).toContain('<b>&lt;img src=x&gt;</b>');
  });

  it('hides the labels that would overlap one that matters more', () => {
    const box = (key: string, priority: number, left: number, top: number): LabelBox => ({
      key, priority, left, top, right: left + 60, bottom: top + 20,
    });
    const shown = visibleLabels([
      box('pasto', 40, 0, 0),
      box('selected', Infinity, 30, 10), // overlaps pasto and wins
      box('tumaco', 10, 200, 0), // far away
      box('touching', 90, 61, 300), // next to tumaco2 within the gap
      box('tumaco2', 20, 0, 300),
    ]);
    expect([...shown].sort()).toEqual(['selected', 'touching', 'tumaco']);
  });

  it('drops the dots that fall under a shown label, so each municipality is one element', () => {
    const label = { left: 100, top: 100, right: 160, bottom: 120 };
    const dot = (key: string, x: number, y: number) => ({ key, left: x - 4, top: y - 4, right: x + 4, bottom: y + 4 });
    // "36" sat on Ancuya's label: its dot goes; one clear of every label stays.
    expect([...coveredDots([dot('36', 150, 110), dot('lejos', 300, 300), dot('borde', 163, 110)], [label])].sort()).toEqual(['36', 'borde']);
    expect(coveredDots([dot('solo', 10, 10)], []).size).toBe(0);
  });

  it('draws a group with its count, in the color of its worst zone', () => {
    expect(clusterMarkerHtml(7, 'extreme')).toBe('<div class="zone-cluster risk-extreme"><b>7</b></div>');
    expect(clusterLabel(7)).toBe('7 municipios. Toca para acercar');
  });
});
