import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, type Subscription } from 'rxjs';
import { apiErrorCode, type ApiErrorCode } from '../core/error/api-error';
import type { FireHistory, Hotspot, ZoneBoundaries, ZoneDetail, ZoneForecast, ZoneRiskSummary } from '../domain/model/risk';
import { FireRepository, ForecastRepository, HotspotRepository, ZoneRepository } from '../domain/repository/repositories';

/** A model forecast is reused this long (ms) when its zone is tapped again in the same session. */
export const FORECAST_TTL_MS = 10 * 60_000;

/** Where the 72 h forecast of the selected zone is: asking, answered, or the request failed. */
export type ForecastStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Same steps for the municipal boundaries; 'idle' again once their notice is closed. */
export type BoundariesStatus = ForecastStatus;

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
  /** The selected zone as the map has it: enough to open its sheet before ZoneDetail arrives. */
  readonly selected = computed(() => this.zones().find((zone) => zone.id === this.selectedId()) ?? null);
  readonly detail = signal<ZoneDetail | null>(null);
  /** Fire records of the selected zone (its "incendios por año"); null until they arrive or if they fail. */
  readonly detailFires = signal<FireHistory | null>(null);
  /** 72 h forecast of the selected zone (the model, or its fallback to the current score). */
  readonly detailForecast = signal<ZoneForecast | null>(null);
  readonly forecastStatus = signal<ForecastStatus>('idle');
  /** Municipal outlines for the map; without them the map keeps working with the markers. */
  readonly boundaries = signal<ZoneBoundaries | null>(null);
  readonly boundariesStatus = signal<BoundariesStatus>('idle');
  readonly loading = signal(false);
  /** Why the zones could not load; the map and Inicio name it in the app's language. */
  readonly error = signal<ApiErrorCode | null>(null);
  readonly updatedAt = signal<Date | null>(null);

  /** Model forecasts by zone, with when they arrived (fallbacks are asked again: the model may be back). */
  private readonly forecasts = new Map<string, { readonly forecast: ZoneForecast; readonly at: number }>();
  /** The forecast request in flight, cancelled when another zone is tapped or the sheet closes. */
  private forecastRequest?: Subscription;

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
      error: (error: unknown) => {
        this.error.set(apiErrorCode(error));
        this.loading.set(false);
      },
    });
  }

  /** Asks for the boundaries once; again only after a failure (the notice's "Reintentar"). */
  loadBoundaries(): void {
    const status = this.boundariesStatus();
    if (status === 'loading' || status === 'ready') return;
    this.boundariesStatus.set('loading');
    this.zoneRepository.boundaries().subscribe({
      next: (boundaries) => {
        this.boundaries.set(boundaries);
        this.boundariesStatus.set('ready');
      },
      // Only the boundaries notice shows it: zones and markers do not depend on them.
      error: () => this.boundariesStatus.set('error'),
    });
  }

  dismissBoundariesError(): void {
    if (this.boundariesStatus() === 'error') this.boundariesStatus.set('idle');
  }

  select(zoneId: string): void {
    this.selectedId.set(zoneId);
    this.detail.set(null);
    this.detailFires.set(null);
    // First: it is the slowest answer (the model runs on the server).
    this.loadForecast(zoneId);
    this.zoneRepository.detail(zoneId).subscribe({
      next: (detail) => {
        if (this.selectedId() === zoneId) this.detail.set(detail);
      },
      error: (error: unknown) => this.error.set(apiErrorCode(error)),
    });
    this.fireRepository.history(zoneId).subscribe({
      next: (history) => {
        if (this.selectedId() === zoneId) this.detailFires.set(history);
      },
      // Without the records the sheet only leaves out its "incendios por año" card.
      error: () => undefined,
    });
  }

  /** Asks again for the forecast of the selected zone (the sheet's "Reintentar"). */
  retryForecast(): void {
    const zoneId = this.selectedId();
    if (zoneId) this.loadForecast(zoneId);
  }

  /** From the session cache if fresh; otherwise asks, dropping the request of the zone tapped before. */
  private loadForecast(zoneId: string): void {
    this.forecastRequest?.unsubscribe();
    const cached = this.forecasts.get(zoneId);
    if (cached && Date.now() - cached.at < FORECAST_TTL_MS) {
      this.detailForecast.set(cached.forecast);
      this.forecastStatus.set('ready');
      return;
    }
    this.detailForecast.set(null);
    this.forecastStatus.set('loading');
    this.forecastRequest = this.forecastRepository.forecast(zoneId).subscribe({
      next: (forecast) => {
        if (forecast.source === 'model') this.forecasts.set(zoneId, { forecast, at: Date.now() });
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
    this.forecastRequest?.unsubscribe();
    this.selectedId.set(null);
    this.detail.set(null);
    this.detailFires.set(null);
    this.detailForecast.set(null);
    this.forecastStatus.set('idle');
  }

  reportError(code: ApiErrorCode): void {
    this.error.set(code);
  }

  dismissError(): void {
    this.error.set(null);
  }
}
