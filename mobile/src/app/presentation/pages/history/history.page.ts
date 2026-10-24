import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  averagePerYear, countsByYear, coverageNote, keepYearRangesTogether, peakYear, recordPeriod, sortByDateDesc,
} from '../../../domain/util/fire-history';
import { API_ERROR_KEYS } from '../../../core/error/api-error';
import { formatDecimal } from '../../../domain/util/format';
import { I18n } from '../../../i18n/i18n';
import { TranslatePipe } from '../../../i18n/t.pipe';
import { HistoryStore } from '../../../state/history.store';
import { ZonesStore } from '../../../state/zones.store';
import { DataAttribution } from '../../components/data-attribution/data-attribution';
import { FireEventTile } from '../../components/fire-event-tile/fire-event-tile';
import { LavaBg } from '../../components/lava-bg/lava-bg';

/** Reports listed before "Ver los N reportes". */
const RECENT_COUNT = 3;
/** Height (px) of the tallest bar; an empty year keeps a stub so its slot is still visible. */
const BAR_MAX_PX = 100;
const BAR_MIN_PX = 4;

@Component({
  selector: 'app-history-page',
  imports: [DataAttribution, FireEventTile, LavaBg, TranslatePipe],
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
  private readonly now = new Date();
  private readonly i18n = inject(I18n);
  protected readonly errorKeys = API_ERROR_KEYS;

  protected readonly period = computed(() => recordPeriod(this.now, this.i18n.language()));
  /** "Pasto · ", or "Nariño · " without a filter ('' while the zone names load). */
  protected readonly placePrefix = computed(() => {
    const zoneId = this.zoneId();
    const name = zoneId ? this.zones().find((zone) => zone.id === zoneId)?.name : 'Nariño';
    return name ? `${name} · ` : '';
  });

  /** Newest first, whatever order the API sends. */
  protected readonly events = computed(() => sortByDateDesc(this.store.history()?.events ?? []));
  protected readonly showAll = signal(false);
  protected readonly shownEvents = computed(() =>
    this.showAll() ? this.events() : this.events().slice(0, RECENT_COUNT),
  );

  protected readonly years = computed(() => countsByYear(this.events(), this.now));
  protected readonly peak = computed(() => peakYear(this.years()));
  protected readonly perYear = computed(() => formatDecimal(averagePerYear(this.events(), this.now), this.i18n.language()));
  protected readonly bars = computed(() => {
    const max = Math.max(1, ...this.years().map((y) => y.count));
    return this.years().map((y) => ({
      ...y,
      height: y.count ? Math.max(BAR_MIN_PX, Math.round((y.count / max) * BAR_MAX_PX)) : BAR_MIN_PX,
    }));
  });
  protected readonly chartLabel = computed(() =>
    this.i18n.t('history.chart', { list: this.years().map((y) => `${y.year}, ${y.count}`).join('; ') }),
  );

  /** Sources and empty years come from the records shown, so they follow the data and the filter. */
  protected readonly coverage = computed(() => keepYearRangesTogether(coverageNote(this.events(), this.i18n.language())));

  constructor() {
    if (this.zonesStore.zones().length === 0) this.zonesStore.load();
    effect(() => {
      const zoneId = this.zoneId();
      this.showAll.set(false);
      this.store.load(zoneId);
    });
  }

  protected filterBy(zoneId?: string): void {
    void this.router.navigate([], { queryParams: { zoneId: zoneId ?? null }, queryParamsHandling: 'merge' });
  }
}
