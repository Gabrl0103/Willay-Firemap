import { TestBed } from '@angular/core/testing';
import type { ZoneDetail } from '../../../domain/model/risk';
import { ZoneSheet, hotspotNote } from './zone-sheet';

const DETAIL: ZoneDetail = {
  id: 'pasto',
  name: 'Pasto',
  score: 42,
  level: 'medium',
  weather: { temperatureC: 18, humidityPct: 70, windKmh: 9, daysWithoutRain: 3 },
  factors: { dryWeather: 40, nearbyHotspots: 20, fireHistory: 60 },
};

function render(detail: ZoneDetail = DETAIL) {
  const fixture = TestBed.createComponent(ZoneSheet);
  fixture.componentRef.setInput('detail', detail);
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

    host.querySelector<HTMLButtonElement>('.sheet-close')!.click();
    fixture.detectChanges();
    expect(sheet.style.transform).toBe('translateY(100%)');
    expect(closed).toBe(0);

    vi.advanceTimersByTime(400);
    expect(closed).toBe(1);
  });

  it('says how long ago the newest nearby hotspot was detected', () => {
    const latestDetectedAt = new Date(Date.now() - 3.5 * 24 * 3_600_000).toISOString();
    const { host } = render({ ...DETAIL, hotspots: { count: 4, latestDetectedAt } });
    const notes = [...host.querySelectorAll('.factor-note')].map((n) => n.textContent!.trim());
    expect(notes).toEqual(['4 focos a 25 km o menos · el último, hace 3 días']);
  });

  it('writes the hotspot note only when the backend sends the data', () => {
    expect(hotspotNote(undefined)).toBe('');
    expect(hotspotNote({ count: 0, latestDetectedAt: null })).toBe('Sin focos a 25 km o menos en los últimos 5 días');
    expect(render().host.querySelectorAll('.factor-note').length).toBe(0);
  });
});
