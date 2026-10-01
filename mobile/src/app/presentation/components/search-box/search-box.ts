import { Component, computed, input, output, signal } from '@angular/core';
import type { ZoneRiskSummary } from '../../../domain/model/risk';
import { RISK_LABELS } from '../../../domain/util/risk-labels';
import { AppIcon } from '../app-icon/app-icon';

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Component({
  selector: 'app-search-box',
  imports: [AppIcon],
  template: `
    <label class="search-wrap">
      <app-icon name="search" [size]="18" />
      <input
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
            <strong [class]="'risk-' + zone.level">{{ zone.score }} · {{ label(zone) }}</strong>
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
