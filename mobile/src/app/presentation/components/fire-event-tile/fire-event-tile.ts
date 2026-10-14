import { Component, computed, input } from '@angular/core';
import type { FireEvent } from '../../../domain/model/risk';
import { hasHectares, splitPlace } from '../../../domain/util/fire-history';
import { dateParts, formatDateLong, formatDecimal } from '../../../domain/util/format';
import { SOURCE_LABELS } from '../../../domain/util/risk-labels';

/** Un reporte de incendio: bloque de fecha, lugar, fuente y hectáreas (solo si la fuente las da). */
@Component({
  selector: 'app-fire-event-tile',
  template: `
    <article class="glass-card event-item" [class.is-news]="event().source === 'news'">
      <time class="date-block mono" [attr.datetime]="event().date" [attr.aria-label]="dateLabel()">
        <b>{{ date().day }}</b>
        <span class="month">{{ date().month }}</span>
        <span>{{ date().year }}</span>
      </time>
      <div class="event-copy">
        <h3>{{ place().name }}</h3>
        <p>{{ meta() }}</p>
      </div>
      @if (hectares(); as area) {
        <div class="event-area">
          <b class="mono">{{ area }} ha</b>
          <span>aprox.</span>
        </div>
      }
    </article>
  `,
  styleUrl: './fire-event-tile.css',
})
export class FireEventTile {
  readonly event = input.required<FireEvent>();
  protected readonly date = computed(() => dateParts(this.event().date));
  protected readonly dateLabel = computed(() => formatDateLong(this.event().date));
  protected readonly place = computed(() => splitPlace(this.event().place));
  /** "Cumbitara · UNGRD" when the place names a locality, otherwise only the source. */
  protected readonly meta = computed(() => {
    const source = SOURCE_LABELS[this.event().source];
    const municipality = this.place().municipality;
    return municipality ? `${municipality} · ${source}` : source;
  });
  protected readonly hectares = computed(() => {
    const hectares = this.event().hectares;
    return hasHectares(hectares) ? formatDecimal(hectares) : null;
  });
}
