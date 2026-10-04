import { Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import {
  coverageNote, keepYearRangesTogether, recordsRangeLabel, sortByDateDesc, totalHectaresLabel,
} from '../../../domain/util/fire-history';
import { formatDateShort } from '../../../domain/util/format';
import { HistoryStore } from '../../../state/history.store';
import { ZonesStore } from '../../../state/zones.store';
import { AppIcon } from '../../components/app-icon/app-icon';
import { DataAttribution } from '../../components/data-attribution/data-attribution';
import { FireEventTile } from '../../components/fire-event-tile/fire-event-tile';

@Component({
  selector: 'app-history-page',
  imports: [AppIcon, DataAttribution, FireEventTile],
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

  /** Newest first, whatever order the API sends. */
  protected readonly events = computed(() => sortByDateDesc(this.store.history()?.events ?? []));

  protected readonly summary = computed(() => {
    const events = this.events();
    return {
      count: events.length,
      hectares: totalHectaresLabel(events),
      last: events[0] ? formatDateShort(events[0].date) : '—',
    };
  });

  /** Range and sources come from the records shown, so they follow the data and the filter. */
  protected readonly recordsRange = computed(() =>
    this.store.history() ? recordsRangeLabel(this.events()) : 'Registros',
  );
  protected readonly coverage = computed(() => keepYearRangesTogether(coverageNote(this.events())));

  constructor() {
    if (this.zonesStore.zones().length === 0) this.zonesStore.load();
    effect(() => this.store.load(this.zoneId()));
  }

  protected filterBy(zoneId?: string): void {
    void this.router.navigate([], { queryParams: { zoneId: zoneId ?? null }, queryParamsHandling: 'merge' });
  }
}
