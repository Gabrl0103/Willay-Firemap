import type { ZoneRiskSummary } from '../../../domain/model/risk';
import { NAME_MIN_ZOOM, showsNames, zoneMarkerHtml } from './zone-marker';

const zone = (name: string): ZoneRiskSummary => ({
  id: 'x', name, latitude: 1, longitude: -77, score: 63, level: 'high',
});

describe('zone marker', () => {
  it('shows names only from the name zoom on', () => {
    expect(showsNames(8)).toBe(false);
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
});
