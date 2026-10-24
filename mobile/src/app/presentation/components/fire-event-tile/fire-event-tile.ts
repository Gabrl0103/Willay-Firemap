import { Component, computed, inject, input } from '@angular/core';
import type { FireEvent } from '../../../domain/model/risk';
import { hasHectares, splitPlace } from '../../../domain/util/fire-history';
import { dateParts, formatDateLong, formatDecimal } from '../../../domain/util/format';
import { I18n } from '../../../i18n/i18n';
import { TranslatePipe } from '../../../i18n/t.pipe';

/** Un reporte de incendio: bloque de fecha, lugar, fuente y hectáreas (solo si la fuente las da). */
@Component({
  selector: 'app-fire-event-tile',
  imports: [TranslatePipe],
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
          <span>{{ 'event.approx' | t }}</span>
        </div>
      }
    </article>
  `,
  styleUrl: './fire-event-tile.css',
})
export class FireEventTile {
  readonly event = input.required<FireEvent>();
  private readonly i18n = inject(I18n);
  protected readonly date = computed(() => dateParts(this.event().date, this.i18n.language()));
  protected readonly dateLabel = computed(() => formatDateLong(this.event().date, this.i18n.language()));
  protected readonly place = computed(() => splitPlace(this.event().place));
  /** "Cumbitara · UNGRD" when the place names a locality, otherwise only the source. */
  protected readonly meta = computed(() => {
    const source = this.event().source === 'ungrd' ? 'UNGRD' : this.i18n.t('source.news');
    const municipality = this.place().municipality;
    return municipality ? `${municipality} · ${source}` : source;
  });
  protected readonly hectares = computed(() => {
    const hectares = this.event().hectares;
    return hasHectares(hectares) ? formatDecimal(hectares, this.i18n.language()) : null;
  });
}
