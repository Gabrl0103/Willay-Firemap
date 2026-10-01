import { Component, computed, input } from '@angular/core';
import type { FireEvent } from '../../../domain/model/risk';
import { formatDateLong, formatHectares } from '../../../domain/util/format';
import { SOURCE_LABELS } from '../../../domain/util/risk-labels';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-fire-event-tile',
  imports: [AppIcon],
  template: `
    <article class="event-item">
      <span class="event-icon"><app-icon name="map-pin" [size]="16" /></span>
      <div class="event-copy">
        <h2>{{ event().place }}</h2>
        <p>{{ date() }}</p>
        <span>{{ hectares() }} ha afectadas</span>
      </div>
      <b class="source-tag" [class.source-news]="event().source === 'news'" [class.source-official]="event().source === 'ungrd'">
        {{ source() }}
      </b>
    </article>
  `,
  styleUrl: './fire-event-tile.css',
})
export class FireEventTile {
  readonly event = input.required<FireEvent>();
  protected readonly date = computed(() => formatDateLong(this.event().date));
  protected readonly hectares = computed(() => formatHectares(this.event().hectares));
  protected readonly source = computed(() => SOURCE_LABELS[this.event().source]);
}
