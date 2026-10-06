import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { FireEvent, FireHistory, ZoneRiskSummary } from '../../../domain/model/risk';
import { WORD_JOINER } from '../../../domain/util/fire-history';
import { HistoryStore } from '../../../state/history.store';
import { ZonesStore } from '../../../state/zones.store';
import { HistoryPage } from './history.page';

const ZONES: ZoneRiskSummary[] = [{ id: 'pasto', name: 'Pasto', latitude: 1.21, longitude: -77.28, score: 62, level: 'high' }];

const fire = (id: string, date: string, hectares: number | null = null): FireEvent => ({
  id, zoneId: 'pasto', place: 'Obonuco, Pasto', date, hectares, source: 'ungrd',
});

const HISTORY: FireHistory = {
  events: [
    fire('a', '2019-03-02', 2),
    fire('b', '2023-08-10'),
    fire('c', '2023-09-12', 1.5),
    fire('d', '2021-01-20'),
    fire('e', '2025-09-12', 3),
  ],
  summary: { count: 5, totalHectares: 6.5, lastDate: '2025-09-12' },
};

const text = (host: HTMLElement, selector: string): string[] =>
  [...host.querySelectorAll(selector)].map((el) => el.textContent!.replace(/\s+/g, ' ').trim());

function render(zoneId?: string) {
  const historyStore = { history: signal(HISTORY), loading: signal(false), error: signal<string | null>(null), load: vi.fn() };
  const zonesStore = { zones: signal(ZONES), load: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: HistoryStore, useValue: historyStore },
      { provide: ZonesStore, useValue: zonesStore },
    ],
  });
  const fixture = TestBed.createComponent(HistoryPage);
  if (zoneId) fixture.componentRef.setInput('zoneId', zoneId);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement, historyStore };
}

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 6, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('names the zone and the period from 1 ene 2019 to today', () => {
    const { host, historyStore } = render('pasto');
    expect(text(host, '.period')).toEqual(['Pasto · del 1 ene 2019 al 6 oct 2026']);
    expect(historyStore.load).toHaveBeenCalledWith('pasto');
  });

  it('names the whole department without a filter', () => {
    expect(text(render().host, '.period')).toEqual(['Nariño · del 1 ene 2019 al 6 oct 2026']);
  });

  it('charts every year since 2019 and highlights the peak', () => {
    const { host } = render('pasto');
    expect(text(host, '.bar-year')).toEqual(['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']);
    expect(text(host, '.bar-value')).toEqual(['1', '0', '1', '0', '2', '0', '1', '0']);
    expect(text(host, '.is-peak .bar-year')).toEqual(['2023']);
    expect(text(host, '.count > *')).toEqual(['5', 'reportes en 8 años']);
    expect(text(host, '.rates > *')).toEqual(['0,6 por año', 'Máximo: 2023 (2)']);
  });

  it('lists the three most recent reports and can show them all', () => {
    const { fixture, host } = render('pasto');
    const dates = (): (string | null)[] =>
      [...host.querySelectorAll('app-fire-event-tile time')].map((time) => time.getAttribute('datetime'));
    expect(dates()).toEqual(['2025-09-12', '2023-09-12', '2023-08-10']);
    expect(host.querySelectorAll('app-fire-event-tile').length).toBe(3);
    expect(text(host, '.list-heading > span')).toEqual(['3 de 5']);

    host.querySelector<HTMLButtonElement>('.show-all')!.click();
    fixture.detectChanges();
    expect(host.querySelectorAll('app-fire-event-tile').length).toBe(5);
    expect(text(host, '.list-heading > span')).toEqual(['5 de 5']);
    expect(host.querySelector('.show-all')).toBeNull();
  });

  it('keeps the sources note and the license credits', () => {
    const { host } = render('pasto');
    expect(text(host, '.sources')).toEqual([`Fuentes: UNGRD (2019–${WORD_JOINER}2025). Sin datos de 2020, 2022 y 2024.`]);
    expect(host.querySelector('app-data-attribution')).not.toBeNull();
  });
});
