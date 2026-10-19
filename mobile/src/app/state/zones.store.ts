import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import type { FireHistory, Hotspot, ZoneDetail, ZoneForecast, ZoneRiskSummary } from '../domain/model/risk';
import { FireRepository, ForecastRepository, HotspotRepository, ZoneRepository } from '../domain/repository/repositories';

/** Where the 72 h forecast of the selected zone is: asking, answered, or the request failed. */
export type ForecastStatus = 'idle' | 'loading' | 'ready' | 'error';

/** State of the map screen (zones, heat spots and the selected zone). Signals = simple and reactive. */
@Injectable({ providedIn: 'root' })
export class ZonesStore {
  private readonly zoneRepository = inject(ZoneRepository);
  private readonly hotspotRepository = inject(HotspotRepository);
  private readonly fireRepository = inject(FireRepository);
  private readonly forecastRepository = inject(ForecastRepository);

  readonly zones = signal<ZoneRiskSummary[]>([]);
  readonly hotspots = signal<Hotspot[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<ZoneDetail | null>(null);
  /** Fire records of the selected zone (its "incendios por año"); null until they arrive or if they fail. */
  readonly detailFires = signal<FireHistory | null>(null);
  /** 72 h forecast of the selected zone (the model, or its fallback to the current score). */
  readonly detailForecast = signal<ZoneForecast | null>(null);
  readonly forecastStatus = signal<ForecastStatus>('idle');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly updatedAt = signal<Date | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      zones: this.zoneRepository.list(),
      hotspots: this.hotspotRepository.list(),
    }).subscribe({
      next: ({ zones, hotspots }) => {
        this.zones.set(zones);
        this.hotspots.set(hotspots);
        this.updatedAt.set(new Date());
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  select(zoneId: string): void {
    this.selectedId.set(zoneId);
    this.detail.set(null);
    this.detailFires.set(null);
    this.zoneRepository.detail(zoneId).subscribe({
      next: (detail) => {
        if (this.selectedId() === zoneId) this.detail.set(detail);
      },
      error: (error: Error) => this.error.set(error.message),
    });
    this.fireRepository.history(zoneId).subscribe({
      next: (history) => {
        if (this.selectedId() === zoneId) this.detailFires.set(history);
      },
      // Without the records the sheet only leaves out its "incendios por año" card.
      error: () => undefined,
    });
    this.loadForecast(zoneId);
  }

  /** Asks again for the forecast of the selected zone (the sheet's "Reintentar"). */
  retryForecast(): void {
    const zoneId = this.selectedId();
    if (zoneId) this.loadForecast(zoneId);
  }

  private loadForecast(zoneId: string): void {
    this.detailForecast.set(null);
    this.forecastStatus.set('loading');
    this.forecastRepository.forecast(zoneId).subscribe({
      next: (forecast) => {
        if (this.selectedId() !== zoneId) return;
        this.detailForecast.set(forecast);
        this.forecastStatus.set('ready');
      },
      // Only the forecast section shows the failure (with its own retry); the rest of the sheet stays.
      error: () => {
        if (this.selectedId() === zoneId) this.forecastStatus.set('error');
      },
    });
  }

  clearSelection(): void {
    this.selectedId.set(null);
    this.detail.set(null);
    this.detailFires.set(null);
    this.detailForecast.set(null);
    this.forecastStatus.set('idle');
  }

  reportError(message: string): void {
    this.error.set(message);
  }

  dismissError(): void {
    this.error.set(null);
  }
}
