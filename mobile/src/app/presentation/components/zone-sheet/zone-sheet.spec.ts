import { TestBed } from '@angular/core/testing';
import type { ZoneDetail } from '../../../domain/model/risk';
import { ZoneSheet } from './zone-sheet';

const text = (host: HTMLElement, selector: string): string[] =>
  [...host.querySelectorAll(selector)].map((el) => el.textContent!.replace(/\s+/g, ' ').trim());

const DETAIL: ZoneDetail = {
  id: 'pasto',
  name: 'Pasto',
  score: 42,
  level: 'medium',
  weather: { temperatureC: 18, humidityPct: 70, windKmh: 9, daysWithoutRain: 3 },
  factors: { dryWeather: 40, nearbyHotspots: 20, fireHistory: 60 },
};

function render(detail: ZoneDetail = DETAIL, inputs: { firesPerYear?: number | null; updatedAt?: Date | null } = {}) {
  const fixture = TestBed.createComponent(ZoneSheet);
  fixture.componentRef.setInput('detail', detail);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const sheet = host.querySelector<HTMLElement>('.zone-sheet')!;
  const handle = host.querySelector<HTMLButtonElement>('.sheet-handle')!;
  return { fixture, host, sheet, handle };
}

describe('ZoneSheet', () => {
  afterEach(() => vi.useRealTimers());

  it('is 85 % tall and toggles between mid and expanded from the handle', () => {
    const { fixture, sheet, handle } = render();
    expect(sheet.style.height).toBe('85%');

    handle.click();
    fixture.detectChanges();
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    expect(sheet.classList).toContain('is-expanded');
    expect(sheet.style.transform).toBe('translateY(0%)');

    handle.click();
    fixture.detectChanges();
    expect(handle.getAttribute('aria-expanded')).toBe('false');
    expect(sheet.style.transform).toMatch(/^translateY\(47\.05/);
  });

  it('slides down before telling the page it closed', () => {
    vi.useFakeTimers();
    const { fixture, host, sheet } = render();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    host.querySelector<HTMLButtonElement>('.sheet-back')!.click();
    fixture.detectChanges();
    expect(sheet.style.transform).toBe('translateY(100%)');
    expect(closed).toBe(0);

    vi.advanceTimersByTime(400);
    expect(closed).toBe(1);
  });

  it('fills the score ring up to the score', () => {
    const { host } = render();
    const ring = host.querySelector<SVGCircleElement>('.ring-value')!;
    const total = 2 * Math.PI * 41.5;
    expect(Number(ring.style.getPropertyValue('--ring-total'))).toBeCloseTo(total, 3);
    expect(Number(ring.style.getPropertyValue('--ring-value'))).toBeCloseTo(total * 0.42, 3);
    expect(text(host, '.score-ring strong, .score-ring span')).toEqual(['42', 'Medio']);
  });

  it('lists the three factors with their weight and value', () => {
    const { host } = render();
    expect(text(host, '.factor-head > *')).toEqual([
      'Clima seco · 50 %', '40', 'Focos cercanos · 30 %', '20', 'Historial · 20 %', '60',
    ]);
    const widths = [...host.querySelectorAll<HTMLElement>('.factor-track span')].map((bar) => bar.style.width);
    expect(widths).toEqual(['40%', '20%', '60%']);
  });

  it('shows the nearby hotspots and when the newest one was detected', () => {
    const latestDetectedAt = new Date(Date.now() - 3.5 * 24 * 3_600_000).toISOString();
    const { host } = render({ ...DETAIL, hotspots: { count: 4, latestDetectedAt } });
    expect(text(host, '.hotspots-stat > *')).toEqual(['4', 'focos a menos de 25 km', 'el último, hace 3 días']);

    const none = render({ ...DETAIL, hotspots: { count: 0, latestDetectedAt: null } }).host;
    expect(text(none, '.hotspots-stat > *')).toEqual(['0', 'focos a menos de 25 km']);
  });

  it('shows the fires per year only when the records arrived', () => {
    expect(text(render(DETAIL, { firesPerYear: 2.08 }).host, '.fires-stat > *')).toEqual(['2,1', 'incendios por año']);
    const { host } = render(DETAIL, { firesPerYear: null });
    expect(host.querySelector('.fires-stat')).toBeNull();
    // Backends older than v0.20 do not send hotspots: no cards at all.
    expect(host.querySelector('.stats')).toBeNull();
  });

  it('says when the data was updated', () => {
    expect(text(render(DETAIL, { updatedAt: new Date() }).host, '.zone-title p')).toEqual(['Nariño · actualizado hoy']);
    expect(text(render().host, '.zone-title p')).toEqual(['Nariño']);
  });
});
