import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import type { FireHistory, Hotspot, ZoneDetail, ZoneRiskSummary } from '../domain/model/risk';
import { FireRepository, HotspotRepository, ZoneRepository } from '../domain/repository/repositories';

/** State of the map screen (zones, heat spots and the selected zone). Signals = simple and reactive. */
@Injectable({ providedIn: 'root' })
export class ZonesStore {
  private readonly zoneRepository = inject(ZoneRepository);
  private readonly hotspotRepository = inject(HotspotRepository);
  private readonly fireRepository = inject(FireRepository);

  readonly zones = signal<ZoneRiskSummary[]>([]);
  readonly hotspots = signal<Hotspot[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<ZoneDetail | null>(null);
  /** Fire records of the selected zone (its "incendios por año"); null until they arrive or if they fail. */
  readonly detailFires = signal<FireHistory | null>(null);
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
  }

  clearSelection(): void {
    this.selectedId.set(null);
    this.detail.set(null);
    this.detailFires.set(null);
  }

  reportError(message: string): void {
    this.error.set(message);
  }

  dismissError(): void {
    this.error.set(null);
  }
}
