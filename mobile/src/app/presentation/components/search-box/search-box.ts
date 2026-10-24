import { Component, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import type { ZoneRiskSummary } from '../../../domain/model/risk';
import { favoriteZones, favoritesFirst } from '../../../domain/util/favorites';
import { riskLabel } from '../../../domain/util/risk-labels';
import { I18n } from '../../../i18n/i18n';
import { TranslatePipe } from '../../../i18n/t.pipe';
import { AppIcon } from '../app-icon/app-icon';
import { RiskBadge } from '../risk-badge/risk-badge';

const MAX_RESULTS = 6;

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Component({
  selector: 'app-search-box',
  imports: [AppIcon, RiskBadge, TranslatePipe],
  template: `
    <div class="search-row">
      <label class="search-wrap">
        <app-icon name="search" [size]="18" />
        <input
          #field
          type="search"
          [placeholder]="'nav.search' | t"
          [attr.aria-label]="'nav.search' | t"
          autocomplete="off"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
          (keydown.escape)="cancelled.emit()"
        />
        @if (query()) {
          <button type="button" class="clear" [attr.aria-label]="'search.clear' | t" (click)="query.set('')">
            <app-icon name="x" [size]="16" />
          </button>
        }
      </label>
      <button type="button" class="cancel" (click)="cancelled.emit()">{{ 'search.cancel' | t }}</button>
    </div>
    @if (results().length > 0) {
      <div class="results">
        @if (!query().trim()) {
          <p class="results-title">{{ 'home.myZones' | t }}</p>
        }
        @for (zone of results(); track zone.id) {
          <button type="button" class="result" (click)="pick(zone)">
            <span class="result-name">{{ zone.name }}@if (isFavorite(zone)) {<app-icon class="favorite-mark" name="heart-filled" [size]="14" />}</span>
            <app-risk-badge [level]="zone.level" [label]="zone.score + ' · ' + label(zone)" />
          </button>
        }
      </div>
    } @else if (query().length > 0) {
      <div class="results empty">{{ 'search.empty' | t }}</div>
    }
  `,
  styleUrl: './search-box.css',
})
export class SearchBox {
  readonly zones = input.required<readonly ZoneRiskSummary[]>();
  /** «Mis municipios»: suggested before typing and listed first in the results, with the heart. */
  readonly favoriteIds = input<readonly string[]>([]);
  readonly selected = output<ZoneRiskSummary>();
  /** «Cancelar» or Escape: the map closes the search layer. */
  readonly cancelled = output<void>();

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    // Opens with the keyboard up: the search layer exists only while searching.
    afterNextRender(() => this.field()?.nativeElement.focus());
  }

  protected readonly query = signal('');
  protected readonly results = computed(() => {
    const term = normalize(this.query().trim());
    if (!term) return favoriteZones(this.favoriteIds(), this.zones()).slice(0, MAX_RESULTS);
    const matches = this.zones().filter((zone) => normalize(zone.name).includes(term));
    return favoritesFirst(matches, this.favoriteIds()).slice(0, MAX_RESULTS);
  });

  protected isFavorite(zone: ZoneRiskSummary): boolean {
    return this.favoriteIds().includes(zone.id);
  }

  private readonly i18n = inject(I18n);

  protected label(zone: ZoneRiskSummary): string {
    return riskLabel(zone.level, this.i18n.language());
  }

  protected pick(zone: ZoneRiskSummary): void {
    this.query.set('');
    this.selected.emit(zone);
  }
}
