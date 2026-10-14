import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { ZoneRiskSummary } from '../../../domain/model/risk';
import { ZonesStore } from '../../../state/zones.store';
import { HomePage } from './home.page';

const ZONES: ZoneRiskSummary[] = [
  { id: 'ipiales', name: 'Ipiales', latitude: 0.83, longitude: -77.64, score: 41, level: 'medium' },
  { id: 'pasto', name: 'Pasto', latitude: 1.21, longitude: -77.28, score: 62, level: 'high' },
];

function render() {
  const store = {
    zones: signal(ZONES),
    hotspots: signal([]),
    loading: signal(false),
    error: signal<string | null>(null),
    load: vi.fn(),
    select: vi.fn(),
  };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ZonesStore, useValue: store }] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  return { host: fixture.nativeElement as HTMLElement, store, navigate };
}

describe('HomePage', () => {
  it('lists the riskiest zones first', () => {
    const { host } = render();
    const names = [...host.querySelectorAll('.zone h3')].map((el) => el.textContent?.trim());
    expect(names).toEqual(['Pasto', 'Ipiales']);
  });

  it('opens the zone sheet on the map when a card is tapped', () => {
    const { host, store, navigate } = render();
    host.querySelector<HTMLButtonElement>('.zone')!.click();
    expect(store.select).toHaveBeenCalledWith('pasto');
    expect(navigate).toHaveBeenCalledWith('/map');
  });

  it('has no settings button', () => {
    const { host } = render();
    expect(host.querySelectorAll('.head button').length).toBe(0);
  });
});
