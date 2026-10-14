import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type { ZoneRiskSummary } from '../../../domain/model/risk';
import { RISK_LABELS } from '../../../domain/util/risk-labels';
import { SearchRequest } from '../../../core/search-request';
import { AppIcon } from '../app-icon/app-icon';
import { RiskBadge } from '../risk-badge/risk-badge';

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Component({
  selector: 'app-search-box',
  imports: [AppIcon, RiskBadge],
  template: `
    <label class="search-wrap">
      <app-icon name="search" [size]="18" />
      <input
        #field
        type="search"
        placeholder="Buscar municipio"
        autocomplete="off"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />
      @if (query()) {
        <button type="button" class="clear" aria-label="Borrar búsqueda" (click)="query.set('')">
          <app-icon name="x" [size]="16" />
        </button>
      }
    </label>
    @if (results().length > 0) {
      <div class="results">
        @for (zone of results(); track zone.id) {
          <button type="button" class="result" (click)="pick(zone)">
            <span>{{ zone.name }}</span>
            <app-risk-badge [level]="zone.level" [label]="zone.score + ' · ' + label(zone)" />
          </button>
        }
      </div>
    } @else if (query().length > 0) {
      <div class="results empty">No encontramos ese municipio.</div>
    }
  `,
  styleUrl: './search-box.css',
})
export class SearchBox {
  readonly zones = input.required<readonly ZoneRiskSummary[]>();
  readonly selected = output<ZoneRiskSummary>();

  private readonly searchRequest = inject(SearchRequest);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    // El botón de búsqueda de la barra inferior pide enfocar este campo.
    effect(() => {
      if (!this.searchRequest.pending()) return;
      this.searchRequest.consume();
      setTimeout(() => this.field()?.nativeElement.focus(), 50);
    });
  }

  protected readonly query = signal('');
  protected readonly results = computed(() => {
    const term = normalize(this.query().trim());
    if (!term) return [];
    return this.zones().filter((zone) => normalize(zone.name).includes(term)).slice(0, 6);
  });

  protected label(zone: ZoneRiskSummary): string {
    return RISK_LABELS[zone.level];
  }

  protected pick(zone: ZoneRiskSummary): void {
    this.query.set('');
    this.selected.emit(zone);
  }
}
