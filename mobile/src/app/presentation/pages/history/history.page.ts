import { Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { formatDateShort, formatHectares } from '../../../domain/util/format';
import { HistoryStore } from '../../../state/history.store';
import { ZonesStore } from '../../../state/zones.store';
import { AppIcon } from '../../components/app-icon/app-icon';
import { FireEventTile } from '../../components/fire-event-tile/fire-event-tile';

@Component({
  selector: 'app-history-page',
  imports: [AppIcon, FireEventTile],
  templateUrl: './history.page.html',
  styleUrl: './history.page.css',
  host: { class: 'ion-page' },
})
export class HistoryPage {
  /** Bound from the query string: /history?zoneId=pasto */
  readonly zoneId = input<string>();

  protected readonly store = inject(HistoryStore);
  protected readonly zones = inject(ZonesStore).zones;
  private readonly zonesStore = inject(ZonesStore);
  private readonly router = inject(Router);

  protected readonly summary = computed(() => {
    const summary = this.store.history()?.summary;
    return {
      count: summary?.count ?? 0,
      hectares: formatHectares(summary?.totalHectares ?? 0),
      last: summary?.lastDate ? formatDateShort(summary.lastDate) : '—',
    };
  });

  constructor() {
    if (this.zonesStore.zones().length === 0) this.zonesStore.load();
    effect(() => this.store.load(this.zoneId()));
  }

  protected filterBy(zoneId?: string): void {
    void this.router.navigate([], { queryParams: { zoneId: zoneId ?? null }, queryParamsHandling: 'merge' });
  }
}
