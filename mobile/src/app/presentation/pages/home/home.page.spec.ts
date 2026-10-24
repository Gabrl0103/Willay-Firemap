import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { ZoneRiskSummary } from '../../../domain/model/risk';
import { FavoritesStore } from '../../../state/favorites.store';
import { SettingsStore } from '../../../state/settings.store';
import { ZonesStore } from '../../../state/zones.store';
import { HomePage } from './home.page';

const ZONES: ZoneRiskSummary[] = [
  { id: 'ipiales', name: 'Ipiales', latitude: 0.83, longitude: -77.64, score: 41, level: 'medium' },
  { id: 'pasto', name: 'Pasto', latitude: 1.21, longitude: -77.28, score: 62, level: 'high' },
];

function render(favoriteIds: string[] = []) {
  const store = {
    zones: signal(ZONES),
    hotspots: signal([]),
    loading: signal(false),
    error: signal<string | null>(null),
    load: vi.fn(),
    select: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ZonesStore, useValue: store },
      { provide: FavoritesStore, useValue: { ids: signal(favoriteIds) } },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement, store, navigate };
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

  it('shows «Mis municipios» above the riskiest zones, skipping favorites that no longer exist', () => {
    const { host, store, navigate } = render(['ipiales', 'borrado']);
    expect([...host.querySelectorAll('h2')].map((el) => el.textContent?.trim())).toEqual(['Mis municipios', 'Zonas con mayor riesgo']);
    const cards = host.querySelectorAll<HTMLButtonElement>('.favorites .zone');
    expect([...cards].map((card) => card.querySelector('h3')?.textContent?.trim())).toEqual(['Ipiales']);
    expect(cards[0]!.querySelector('.favorite-mark')).not.toBeNull();
    expect(cards[0]!.querySelectorAll('button').length).toBe(0); // the heart only marks it

    cards[0]!.click();
    expect(store.select).toHaveBeenCalledWith('ipiales');
    expect(navigate).toHaveBeenCalledWith('/map');
  });

  it('leaves «Mis municipios» out when there are no favorites', () => {
    const { host } = render(['borrado']);
    expect(host.querySelector('.favorites')).toBeNull();
    expect(host.textContent).not.toContain('Mis municipios');
  });

  it('switches to English at once when the language changes', async () => {
    const { fixture, host } = render();
    expect(host.querySelector('h1')?.textContent).toBe('Nariño hoy');
    await TestBed.inject(SettingsStore).update({ language: 'en' });
    fixture.detectChanges();
    expect(host.querySelector('h1')?.textContent).toBe('Nariño today');
    expect([...host.querySelectorAll('h2')].map((el) => el.textContent?.trim())).toEqual(['Highest-risk areas']);
    expect(host.querySelector('.zone p')?.textContent).toBe('62 of 100');
    expect(host.querySelector('.average strong')?.textContent).toBe('High'); // average 52
    expect(host.querySelector('.zone .badge')?.textContent).toBe('High');
  });

  it('has no settings button', () => {
    const { host } = render();
    expect(host.querySelectorAll('.head button').length).toBe(0);
  });
});
