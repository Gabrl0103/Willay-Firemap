import { readRiskColors, zoneAreaStyle, type RiskColors } from './zone-area';

const COLORS: RiskColors = { low: '#4ade80', medium: '#facc15', high: '#ff7a1a', extreme: '#ff3b3b' };

describe('zone area (municipal polygon)', () => {
  it('fills with the risk color, translucent, with a thin outline', () => {
    const style = zoneAreaStyle('high', false, COLORS);
    expect(style.fillColor).toBe('#ff7a1a');
    expect(style.fillOpacity).toBeLessThan(0.5);
    expect(style.weight).toBeLessThan(1);
  });

  it('makes the selected zone stronger, with a wider outline', () => {
    const normal = zoneAreaStyle('low', false, COLORS);
    const selected = zoneAreaStyle('low', true, COLORS);
    expect(selected.fillColor).toBe('#4ade80');
    expect(selected.fillOpacity!).toBeGreaterThan(normal.fillOpacity!);
    expect(selected.weight!).toBeGreaterThan(normal.weight!);
  });

  it('keeps a neutral fill for zones without a score yet', () => {
    const style = zoneAreaStyle(undefined, false, COLORS);
    expect(Object.values(COLORS)).not.toContain(style.fillColor);
  });

  it('reads the colors from the --risk-* tokens', () => {
    const element = document.createElement('div');
    element.style.setProperty('--risk-low', ' #4ade80');
    element.style.setProperty('--risk-medium', '#facc15');
    element.style.setProperty('--risk-high', '#ff7a1a');
    element.style.setProperty('--risk-extreme', '#ff3b3b');
    document.body.append(element);
    expect(readRiskColors(element)).toEqual(COLORS);
    element.remove();
  });
});
