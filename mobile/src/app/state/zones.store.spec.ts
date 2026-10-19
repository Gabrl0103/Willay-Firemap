import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import type { ZoneDetail, ZoneForecast } from '../domain/model/risk';
import { FireRepository, ForecastRepository, HotspotRepository, ZoneRepository } from '../domain/repository/repositories';
import { ZonesStore } from './zones.store';

const DETAIL = { id: 'pasto', name: 'Pasto', score: 37, level: 'medium' } as ZoneDetail;
const FORECAST: ZoneForecast = {
  zoneId: 'pasto',
  source: 'model',
  modelVersion: '1.0.0',
  generatedAt: '2026-10-18T15:00:00Z',
  horizons: [{ hours: 24, baseDate: '2026-10-18', probability: 0.24, score: 24, level: 'low' }],
};

function setup(forecast: ForecastRepository['forecast']) {
  const repository = { forecast: vi.fn(forecast) };
  TestBed.configureTestingModule({
    providers: [
      { provide: ZoneRepository, useValue: { list: () => of([]), detail: () => of(DETAIL) } },
      { provide: FireRepository, useValue: { history: () => of({ events: [], summary: { count: 0, totalHectares: 0, lastDate: null } }) } },
      { provide: HotspotRepository, useValue: { list: () => of([]) } },
      { provide: ForecastRepository, useValue: repository },
    ],
  });
  return { store: TestBed.inject(ZonesStore), repository };
}

describe('ZonesStore forecast', () => {
  it('asks for the forecast of the selected zone', () => {
    const { store, repository } = setup(() => of(FORECAST));
    store.select('pasto');
    expect(repository.forecast).toHaveBeenCalledWith('pasto');
    expect(store.forecastStatus()).toBe('ready');
    expect(store.detailForecast()).toEqual(FORECAST);
  });

  it('keeps a fallback answer as data (the section explains it)', () => {
    const fallback: ZoneForecast = {
      zoneId: 'pasto', source: 'fallback', reason: 'weather_unavailable', generatedAt: '2026-10-18T15:00:00Z',
      current: { score: 37, level: 'medium' },
    };
    const { store } = setup(() => of(fallback));
    store.select('pasto');
    expect(store.forecastStatus()).toBe('ready');
    expect(store.detailForecast()).toEqual(fallback);
  });

  it('marks only the forecast as failed and retries it', () => {
    let fail = true;
    const { store, repository } = setup(() => (fail ? throwError(() => new Error('No se pudo conectar con el servidor.')) : of(FORECAST)));
    store.select('pasto');
    expect(store.forecastStatus()).toBe('error');
    expect(store.error()).toBeNull(); // the map banner stays for zone errors
    expect(store.detail()).toEqual(DETAIL);

    fail = false;
    store.retryForecast();
    expect(repository.forecast).toHaveBeenCalledTimes(2);
    expect(store.forecastStatus()).toBe('ready');
  });

  it('ignores a late answer for a zone that is no longer selected', () => {
    const late = new Subject<ZoneForecast>();
    const { store } = setup(() => late);
    store.select('pasto');
    store.clearSelection();
    late.next(FORECAST);
    expect(store.detailForecast()).toBeNull();
    expect(store.forecastStatus()).toBe('idle');
  });
});
